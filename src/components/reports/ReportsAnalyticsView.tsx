import React, { useState, useEffect, useMemo } from 'react';
import type { Property } from '../../types/property';
import type { Tenant } from '../../types/tenant';
import type {
  RentBill,
  RentPayment,
  Expense,
  FamilyDistribution,
  ReserveFundAccount,
  ReserveLedgerEntry,
} from '../../types/finance';
import type { ReportType } from '../../types/reports';
import { subscribeProperties } from '../../services/propertyService';
import { subscribeTenants } from '../../services/tenantService';
import { subscribeRentBills, subscribeRentPayments } from '../../services/rentService';
import { subscribeExpenses } from '../../services/expenseService';
import {
  subscribeMonthlyDistribution,
  subscribeReserveFund,
  subscribeReserveLedger,
} from '../../services/distributionService';
import {
  calculateMonthlyFinancialStatement,
  calculateYearlyFinancialSummary,
  calculatePropertyIncomeReport,
  calculatePropertyExpenseReport,
  calculateTenantRentLedger,
  calculateOutstandingRentReport,
  calculateBuildingExpenseReport,
  calculateFamilyExpenseReport,
  calculateDistributionStatement,
  calculateReserveFundStatement,
  calculateNetOperatingBalance,
  calculateBudgetVsActualReport,
} from '../../services/reportService';
import { exportToCSV, printCurrentReport } from '../../utils/exportUtils';
import {
  MonthlyStatementView,
  YearlySummaryView,
  PropertyIncomeView,
  PropertyExpenseView,
  TenantLedgerView,
  OutstandingRentView,
  BuildingExpenseView,
  FamilyExpenseView,
  DistributionStatementView,
  ReserveFundStatementView,
  NetOperatingStatementView,
  BudgetVsActualView,
} from './ReportViews';

interface ReportsAnalyticsViewProps {
  ownerUid: string;
  /** Rendered inside the Hisab dashboard tab (month is dashboard-controlled). */
  embedded?: boolean;
  month?: string;
  onMonthChange?: (month: string) => void;
}

/**
 * Report inputs are read-only snapshots of Firestore data. Legacy bills may
 * have been written before optional charge fields existed (or as numeric
 * strings), so values are normalized here instead of letting the strict money
 * helpers throw during a report render.
 */
function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export const ReportsAnalyticsView: React.FC<ReportsAnalyticsViewProps> = ({
  ownerUid,
  embedded = false,
  month,
  onMonthChange,
}) => {
  // Collections data state
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bills, setBills] = useState<RentBill[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [distribution, setDistribution] = useState<FamilyDistribution | null>(null);
  const [allDistributions, setAllDistributions] = useState<FamilyDistribution[]>([]);
  const [reserveFund, setReserveFund] = useState<ReserveFundAccount | null>(null);
  const [reserveLedger, setReserveLedger] = useState<ReserveLedgerEntry[]>([]);

  // Filter state
  const [reportType, setReportType] = useState<ReportType>('monthly_statement');
  const [internalMonth, setInternalMonth] = useState<string>('2026-11');
  // When the dashboard passes a month, it is the source of truth for every
  // report period so all tabs stay on the same accounting month.
  const selectedMonth = month ?? internalMonth;
  const setSelectedMonth = (nextMonth: string) => {
    setInternalMonth(nextMonth);
    onMonthChange?.(nextMonth);
  };
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');

  // Subscriptions
  useEffect(() => {
    if (!ownerUid) return;

    const unsubProps = subscribeProperties(ownerUid, (data) => setProperties(data));
    const unsubTenants = subscribeTenants(ownerUid, null, (data) => setTenants(data));
    const unsubBills = subscribeRentBills(ownerUid, {}, (data) => setBills(data));
    const unsubPayments = subscribeRentPayments(ownerUid, {}, (data) => setPayments(data));
    const unsubExpenses = subscribeExpenses(ownerUid, {}, (data) => setExpenses(data));
    const unsubFund = subscribeReserveFund(ownerUid, (data) => setReserveFund(data));
    const unsubLedger = subscribeReserveLedger(ownerUid, (data) => setReserveLedger(data));

    return () => {
      unsubProps();
      unsubTenants();
      unsubBills();
      unsubPayments();
      unsubExpenses();
      unsubFund();
      unsubLedger();
    };
  }, [ownerUid]);

  // Subscribe to monthly distribution when month changes
  useEffect(() => {
    if (!ownerUid) return;
    const unsubDist = subscribeMonthlyDistribution(ownerUid, selectedMonth, (dist) => {
      setDistribution(dist);
      if (dist) {
        setAllDistributions((prev) => {
          const filtered = prev.filter((d) => d.distributionMonth !== dist.distributionMonth);
          return [...filtered, dist];
        });
      }
    });

    return () => unsubDist();
  }, [ownerUid, selectedMonth]);

  // Month navigation helpers
  function handlePrevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const yr = prevDate.getFullYear();
    const mo = String(prevDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yr}-${mo}`);
    setSelectedYear(yr);
  }

  function handleNextMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const yr = nextDate.getFullYear();
    const mo = String(nextDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yr}-${mo}`);
    setSelectedYear(yr);
  }

  // Declaratively resolve effective tenant for tenant ledger
  const effectiveTenantId = useMemo(() => {
    if (selectedTenantId !== 'all') return selectedTenantId;
    return tenants.length > 0 ? tenants[0].id : '';
  }, [selectedTenantId, tenants]);

  // Legacy bills created before the current schema may not carry optional
  // charge fields (gas/water/service/other). Reports sum those fields, so the
  // read-only inputs are normalized here (missing -> 0) rather than weakening
  // the strict money helpers or changing any report formula.
  const reportBills = useMemo(
    () =>
      bills.map((bill) => ({
        ...bill,
        rentAmount: toFiniteNumber(bill.rentAmount),
        gasCharge: toFiniteNumber(bill.gasCharge),
        waterCharge: toFiniteNumber(bill.waterCharge),
        serviceCharge: toFiniteNumber(bill.serviceCharge),
        otherCharges: toFiniteNumber(bill.otherCharges),
        totalDue: toFiniteNumber(bill.totalDue),
        totalPaid: toFiniteNumber(bill.totalPaid),
        balanceDue: toFiniteNumber(bill.balanceDue),
      })),
    [bills]
  );

  const reportPayments = useMemo(
    () => payments.map((payment) => ({ ...payment, amount: toFiniteNumber(payment.amount) })),
    [payments]
  );

  const reportExpenses = useMemo(
    () => expenses.map((expense) => ({ ...expense, amount: toFiniteNumber(expense.amount) })),
    [expenses]
  );

  const reportTenants = useMemo(
    () =>
      tenants.map((tenant) => ({
        ...tenant,
        monthlyRent: toFiniteNumber(tenant.monthlyRent),
        gasCharge: toFiniteNumber(tenant.gasCharge),
        waterCharge: toFiniteNumber(tenant.waterCharge),
        advanceDeposit: toFiniteNumber(tenant.advanceDeposit),
      })),
    [tenants]
  );

  const reportReserveLedger = useMemo(
    () =>
      reserveLedger.map((entry) => ({
        ...entry,
        amount: toFiniteNumber(entry.amount),
        balanceBefore: toFiniteNumber(entry.balanceBefore),
        balanceAfter: toFiniteNumber(entry.balanceAfter),
      })),
    [reserveLedger]
  );

  // Calculated Reports
  const monthlyStatement = useMemo(() => {
    return calculateMonthlyFinancialStatement(
      selectedMonth,
      reportPayments,
      reportBills,
      reportExpenses,
      distribution,
      reportTenants
    );
  }, [selectedMonth, reportPayments, reportBills, reportExpenses, distribution, reportTenants]);

  const yearlySummary = useMemo(() => {
    return calculateYearlyFinancialSummary(
      selectedYear,
      reportPayments,
      reportExpenses,
      allDistributions
    );
  }, [selectedYear, reportPayments, reportExpenses, allDistributions]);

  const propertyIncome = useMemo(() => {
    return calculatePropertyIncomeReport(
      selectedMonth,
      properties,
      reportPayments,
      reportBills,
      selectedMonth
    );
  }, [selectedMonth, properties, reportPayments, reportBills]);

  const propertyExpense = useMemo(() => {
    return calculatePropertyExpenseReport(
      selectedMonth,
      properties,
      reportExpenses,
      selectedMonth
    );
  }, [selectedMonth, properties, reportExpenses]);

  const selectedTenant = useMemo(() => {
    return reportTenants.find((t) => t.id === effectiveTenantId) || null;
  }, [reportTenants, effectiveTenantId]);

  const tenantLedger = useMemo(() => {
    if (!selectedTenant) return null;
    return calculateTenantRentLedger(selectedTenant, reportBills, reportPayments);
  }, [selectedTenant, reportBills, reportPayments]);

  const outstandingRent = useMemo(() => {
    return calculateOutstandingRentReport(
      selectedMonth,
      reportBills,
      undefined, // show all outstanding across time for full collection follow-up
      selectedPropertyId
    );
  }, [selectedMonth, reportBills, selectedPropertyId]);

  const buildingExpense = useMemo(() => {
    return calculateBuildingExpenseReport(
      selectedMonth,
      reportExpenses,
      selectedMonth,
      selectedPropertyId
    );
  }, [selectedMonth, reportExpenses, selectedPropertyId]);

  const familyExpense = useMemo(() => {
    return calculateFamilyExpenseReport(selectedMonth, reportExpenses, selectedMonth);
  }, [selectedMonth, reportExpenses]);

  const distributionStatement = useMemo(() => {
    return calculateDistributionStatement(distribution);
  }, [distribution]);

  const reserveFundStatement = useMemo(() => {
    return calculateReserveFundStatement(reserveFund, reportReserveLedger, selectedMonth);
  }, [reserveFund, reportReserveLedger, selectedMonth]);

  const netOperatingBalance = useMemo(() => {
    return calculateNetOperatingBalance(selectedMonth, monthlyStatement);
  }, [selectedMonth, monthlyStatement]);

  const budgetVsActual = useMemo(() => {
    return calculateBudgetVsActualReport(selectedMonth, reportExpenses);
  }, [selectedMonth, reportExpenses]);

  // CSV Export handler
  function handleExportCSV() {
    const filenamePrefix = `bhuiya-report-${reportType}-${selectedMonth}`;

    switch (reportType) {
      case 'monthly_statement': {
        const headers = ['বিবরণ (Description)', 'পরিমাণ (BDT)'];
        const rows = [
          ['বাড়ি ভাড়া আদায় (Rent Received)', monthlyStatement.actualRentalIncome],
          ['গ্যাস বিল আদায় (Gas Collected)', monthlyStatement.actualGasIncome],
          ['পানি বিল আদায় (Water Collected)', monthlyStatement.actualWaterIncome],
          ['মোট পরিচালন আয় (Total Operating Income)', monthlyStatement.totalOperatingIncome],
          ['ভবন পরিচালন খরচ (Building Operating Expenses)', -monthlyStatement.buildingOperatingExpenses],
          ['পারিবারিক ও সামাজিক খরচ (Family Expenses)', -monthlyStatement.familySocialExpenses],
          ['মোট পরিচালন ব্যয় (Total Operating Expenses)', -monthlyStatement.totalOperatingExpenses],
          ['নিট পরিচালন উদ্বৃত্ত (Net Operating Surplus)', monthlyStatement.netOperatingSurplus],
          ['রিজার্ভ হতে সহায়তা (Reserve Inflow)', monthlyStatement.reserveInflow],
          ['পারিবারিক বণ্টন পরিশোধ (Family Distribution Disbursed)', -monthlyStatement.totalFamilyDistributionDisbursed],
          ['উদ্বৃত্ত রিজার্ভে জমা (Surplus to Reserve)', -monthlyStatement.reserveOutflow],
          ['সমাপনী নগদ স্থিতি (Ending Cash Balance)', monthlyStatement.endingCashBalance],
          ['জামানত স্থিতি (Security Deposits Liability)', monthlyStatement.securityDepositsHeld],
        ];
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'yearly_summary': {
        const headers = [
          'মাস (Month)',
          'আয় (Income)',
          'ভবন খরচ (Building)',
          'পারিবারিক খরচ (Family)',
          'মোট খরচ (Total Exp)',
          'নিট উদ্বৃত্ত (Net Surplus)',
          'বণ্টন (Disbursed)',
          'রিজার্ভ নিট (Reserve Net)',
        ];
        const rows = yearlySummary.months.map((m) => [
          m.month,
          m.operatingIncome,
          m.buildingExpenses,
          m.familyExpenses,
          m.totalExpenses,
          m.netOperatingSurplus,
          m.distributionDisbursed,
          m.reserveNetTransfer,
        ]);
        rows.push([
          'সর্বমোট (Total)',
          yearlySummary.totalOperatingIncome,
          yearlySummary.totalBuildingExpenses,
          yearlySummary.totalFamilyExpenses,
          yearlySummary.totalExpenses,
          yearlySummary.totalNetOperatingSurplus,
          yearlySummary.totalDistributionDisbursed,
          yearlySummary.totalReserveNetTransfer,
        ]);
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'property_income': {
        const headers = [
          'ভবন (Property)',
          'মোট ইউনিট',
          'দখল ইউনিট',
          'ভাড়া দাবি',
          'ভাড়া আদায়',
          'গ্যাস আদায়',
          'পানি আদায়',
          'মোট আদায়',
          'বকেয়া',
          'আদায় হার (%)',
        ];
        const rows = propertyIncome.properties.map((p) => [
          p.propertyName,
          p.totalUnits,
          p.occupiedUnits,
          p.totalBilled,
          p.rentCollected,
          p.gasCollected,
          p.waterCollected,
          p.totalCollected,
          p.totalDue,
          `${p.collectionRate}%`,
        ]);
        rows.push([
          'মোট যোগফল',
          '',
          '',
          propertyIncome.totalBilled,
          '',
          '',
          '',
          propertyIncome.totalCollected,
          propertyIncome.totalDue,
          `${propertyIncome.overallCollectionRate}%`,
        ]);
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'property_expenses': {
        const headers = [
          'ভবন (Property)',
          'বিদ্যুৎ',
          'গ্যাস',
          'পানি',
          'কেয়ারটেকার',
          'মেরামত',
          'পরিচ্ছন্নতা',
          'নিরাপত্তা',
          'অন্যান্য',
          'মোট খরচ',
          'শতাংশ (%)',
        ];
        const rows = propertyExpense.rows.map((r) => [
          r.propertyName,
          r.electricity,
          r.gas,
          r.water,
          r.caretaker,
          r.maintenance,
          r.cleaning,
          r.security,
          r.otherBuilding,
          r.totalPropertyExpense,
          `${r.percentageOfTotal}%`,
        ]);
        rows.push([
          'সর্বমোট ভবন খরচ',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          propertyExpense.totalBuildingExpenses,
          '100%',
        ]);
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'tenant_ledger': {
        if (!tenantLedger) return;
        const headers = [
          'তারিখ (Date)',
          'ধরণ (Type)',
          'বিলিং মাস',
          'বিবরণ',
          'দাবি (Billed)',
          'পরিশোধ (Paid)',
          'মেথড / রসিদ',
        ];
        const rows = tenantLedger.entries.map((e) => [
          e.date,
          e.type,
          e.billingMonth,
          e.description,
          e.type === 'bill' ? e.totalBilled : 0,
          e.type === 'payment' ? e.amountPaid : 0,
          e.paymentMethod ? `${e.paymentMethod} #${e.receiptNumber || ''}` : '',
        ]);
        rows.push([
          'মোট',
          '',
          '',
          '',
          tenantLedger.totalBilled,
          tenantLedger.totalPaid,
          `বকেয়া: ${tenantLedger.totalOutstandingDue}`,
        ]);
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'outstanding_rent': {
        const headers = [
          'ভাড়াটিয়া (Tenant)',
          'মোবাইল (Phone)',
          'ভবন (Property)',
          'ফ্ল্যাট (Unit)',
          'বিলিং মাস',
          'মোট দাবি',
          'পরিশোধিত',
          'বকেয়া স্থিতি',
          'স্ট্যাটাস',
          'বিলম্ব (দিন)',
        ];
        const rows = outstandingRent.items.map((i) => [
          i.tenantName,
          i.tenantPhone,
          i.propertyName,
          i.unitNumber,
          i.billingMonth,
          i.totalDue,
          i.totalPaid,
          i.balanceDue,
          i.status,
          i.daysOverdue,
        ]);
        rows.push([
          'সর্বমোট বকেয়া',
          '',
          '',
          '',
          '',
          '',
          '',
          outstandingRent.totalOverdueAmount,
          `${outstandingRent.overdueBillsCount} টি বিল`,
          '',
        ]);
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'building_expenses': {
        const headers = ['খাত (Category BN)', 'খাত (Category EN)', 'রেকর্ড সংখ্যা', 'মোট পরিমাণ (BDT)', 'শতাংশ (%)'];
        const rows = buildingExpense.categories.map((c) => [
          c.categoryLabelBn,
          c.categoryLabelEn,
          c.entryCount,
          c.totalAmount,
          `${c.percentageOfTotal}%`,
        ]);
        rows.push([
          'সর্বমোট ভবন খরচ',
          '',
          buildingExpense.activeEntriesCount,
          buildingExpense.totalBuildingExpenses,
          '100%',
        ]);
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'family_expenses': {
        const headers = ['খাত (Category BN)', 'খাত (Category EN)', 'রেকর্ড সংখ্যা', 'মোট পরিমাণ (BDT)', 'শতাংশ (%)'];
        const rows = familyExpense.categories.map((c) => [
          c.categoryLabelBn,
          c.categoryLabelEn,
          c.entryCount,
          c.totalAmount,
          `${c.percentageOfTotal}%`,
        ]);
        rows.push([
          'সর্বমোট পারিবারিক খরচ',
          '',
          familyExpense.activeEntriesCount,
          familyExpense.totalFamilyExpenses,
          '100%',
        ]);
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'family_distribution': {
        const headers = [
          'অংশীদার (Beneficiary)',
          'সম্পর্ক',
          'মূল লক্ষ্য',
          'সমন্বয়',
          'চূড়ান্ত লক্ষ্য',
          'পরিশোধিত',
          'অবশিষ্ট বকেয়া',
          'স্ট্যাটাস',
        ];
        const rows = distributionStatement.beneficiaries.map((b) => [
          b.name,
          b.relationshipLabelBn,
          b.baseMonthlyTarget,
          b.specialAdjustment,
          b.effectiveTarget,
          b.actualDisbursed,
          b.pendingAmount,
          b.payoutStatus,
        ]);
        rows.push([
          'মোট',
          '',
          distributionStatement.totalBaseTarget,
          distributionStatement.totalSpecialAdjustments,
          distributionStatement.finalTargetTotal,
          distributionStatement.actualTotalDisbursed,
          distributionStatement.remainingPendingTotal,
          '',
        ]);
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'reserve_fund': {
        const headers = [
          'তারিখ (Date)',
          'লেনদেনের ধরণ',
          'মাস',
          'পরিমাণ',
          'পূর্ববর্তী স্থিতি',
          'পরবর্তী স্থিতি',
          'কারণ ও অনুমোদন',
          'ভাড়া আয় নয় (isRentalIncome: false)',
        ];
        const rows = reserveFundStatement.ledgerEntries.map((l) => [
          l.date,
          l.typeLabelBn,
          l.distributionMonth || '',
          l.amount,
          l.balanceBefore,
          l.balanceAfter,
          l.reason,
          'FALSE (Verified)',
        ]);
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'net_operating': {
        const headers = ['লাইন আইটেম (Cash Flow Item)', 'পরিমাণ (BDT)'];
        const rows = [
          ['(ক) মোট পরিচালন আয় ও আদায়', netOperatingBalance.totalCollectedIncome],
          ['বাড়ি ভাড়া বাবদ নগদ প্রাপ্তি', netOperatingBalance.actualRentalIncome],
          ['ইউটিলিটি নগদ প্রাপ্তি', netOperatingBalance.actualGasIncome + netOperatingBalance.actualWaterIncome],
          ['(খ) মোট পরিচালন ব্যয়', -netOperatingBalance.totalExpensesDeducted],
          ['ভবন পরিচালন খরচ', -netOperatingBalance.buildingOperatingExpenses],
          ['পারিবারিক ও সামাজিক খরচ', -netOperatingBalance.familySocialExpenses],
          ['(গ) নিট পরিচালন উদ্বৃত্ত/ঘাটতি (ক - খ)', netOperatingBalance.operatingSurplusOrDeficit],
          ['(ঘ) রিজার্ভ ফান্ড হতে সহায়তা', netOperatingBalance.reserveInflow],
          ['(ঙ) মোট বণ্টনের জন্য উপলব্ধ তহবিল (গ + ঘ)', netOperatingBalance.totalDisbursablePool],
          ['(চ) পারিবারিক বণ্টন পরিশোধ', -netOperatingBalance.actualDisbursedToFamily],
          ['(ছ) উদ্বৃত্ত রিজার্ভে জমা', -netOperatingBalance.surplusTransferredToReserve],
          ['(জ) সমাপনী অবণ্টনকৃত নগদ স্থিতি', netOperatingBalance.unallocatedClosingCash],
        ];
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
      case 'budget_vs_actual': {
        const headers = ['খাত / বিবরণ', 'বাজেট / পরিমাণ (BDT)', 'শতাংশ'];
        const rows = [
          ['মাসিক বাজেট লক্ষ্যমাত্রা', budgetVsActual.budgetTarget, '100%'],
          ['প্রকৃত ভবন পরিচালন খরচ', budgetVsActual.actualBuildingExpense, `${100 + budgetVsActual.variancePercentage}%`],
          ['বাজেট ব্যবধান (Variance)', budgetVsActual.varianceAmount, `${budgetVsActual.variancePercentage}%`],
          ['বাজেট স্ট্যাটাস', budgetVsActual.status, ''],
        ];
        budgetVsActual.categoryBreakdown.forEach((c) => {
          rows.push([`${c.categoryLabelBn} (${c.categoryLabelEn})`, c.actualAmount, `${c.percentageOfActual}%`]);
        });
        exportToCSV(filenamePrefix, headers, rows);
        break;
      }
    }
  }

  // Report navigation configuration
  const reportOptions: { id: ReportType; nameBn: string; nameEn: string; icon: string }[] = [
    { id: 'monthly_statement', nameBn: 'মাসিক আর্থিক বিবরণী', nameEn: 'Monthly Statement', icon: '📄' },
    { id: 'yearly_summary', nameBn: 'বার্ষিক আর্থিক সারসংক্ষেপ', nameEn: 'Yearly Summary', icon: '📊' },
    { id: 'property_income', nameBn: 'প্রপার্টি-ভিত্তিক আয়', nameEn: 'Property Income', icon: '🏢' },
    { id: 'property_expenses', nameBn: 'প্রপার্টি-ভিত্তিক খরচ', nameEn: 'Property Expense', icon: '🧾' },
    { id: 'tenant_ledger', nameBn: 'ভাড়াটিয়া খতিয়ান (লেজার)', nameEn: 'Tenant Ledger', icon: '👤' },
    { id: 'outstanding_rent', nameBn: 'বকেয়া ভাড়ার রিপোর্ট', nameEn: 'Outstanding Rent', icon: '⚠️' },
    { id: 'building_expenses', nameBn: 'ভবন পরিচালন খরচ রিপোর্ট', nameEn: 'Building Expenses', icon: '🏗️' },
    { id: 'family_expenses', nameBn: 'পারিবারিক ও সামাজিক খরচ', nameEn: 'Family Expenses', icon: '👨‍👩‍👦' },
    { id: 'family_distribution', nameBn: 'পারিবারিক বণ্টন বিবরণী', nameEn: 'Distribution Statement', icon: '🤝' },
    { id: 'reserve_fund', nameBn: 'রিজার্ভ ফান্ড স্টেটমেন্ট', nameEn: 'Reserve Fund Statement', icon: '🛡️' },
    { id: 'net_operating', nameBn: 'নিট পরিচালন উদ্বৃত্ত ও নগদ প্রবাহ', nameEn: 'Net Cash Flow', icon: '💰' },
    { id: 'budget_vs_actual', nameBn: 'বাজেট বনাম প্রকৃত খরচ', nameEn: 'Budget vs Actual', icon: '🎯' },
  ];

  return (
    <div className={`operations-view ${embedded ? 'print-container space-y-3' : 'print-container space-y-6'}`}>
      {/* =====================================================================
          PRINT-ONLY OFFICIAL HEADER (Rendered only during print/PDF)
         ===================================================================== */}
      <div className="print-only mb-6 border-b-2 border-slate-800 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              ভূঁইয়া প্রপার্টি ম্যানেজার (Bhuiya Property Manager)
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              আর্থিক অডিট ও রিপোর্টিং কন্ট্রোল সিস্টেম • ঢাকা, বাংলাদেশ
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            <p>তারিখ: {new Date().toLocaleDateString('bn-BD')} / {new Date().toISOString().split('T')[0]}</p>
            <p>অডিট রেফারেন্স: #{ownerUid.slice(0, 8)}</p>
          </div>
        </div>
        <div className="mt-3 py-1.5 px-3 bg-slate-100 rounded text-center">
          <p className="text-sm font-bold text-slate-800">
            {reportOptions.find((r) => r.id === reportType)?.nameBn} ({reportOptions.find((r) => r.id === reportType)?.nameEn})
          </p>
          <p className="text-xs text-slate-600 font-medium">
            রিপোর্ট সময়কাল: <span className="font-semibold text-slate-800">{selectedMonth}</span>
            {selectedPropertyId !== 'all' && (
              <span> • ভবন: {properties.find((p) => p.id === selectedPropertyId)?.name}</span>
            )}
          </p>
        </div>
      </div>

      {/* =====================================================================
          SCREEN-ONLY TOP TOOLBAR: Report Type & Filters
         ===================================================================== */}
      <div className="no-print space-y-4">
        {/* Header Title & Actions */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              Phase 7: আর্থিক রিপোর্ট ও বিশ্লেষণ প্ল্যাটফর্ম (Live)
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              আর্থিক প্রতিবেদন ও বিশ্লেষণ কেন্দ্র / Reports & Statements
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              প্রকৃত আর্থিক খতিয়ান হতে স্বয়ংক্রিয়ভাবে সমন্বিত ১২টি প্রামাণ্য হিসাব প্রতিবেদন
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={printCurrentReport}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="প্রিন্ট বা PDF হিসেবে সংরক্ষণ করুন"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.07-.641-2.11-1.19-3.088m0 0a17.95 17.95 0 0 1 2.277-1.12M4.5 10.74a17.96 17.96 0 0 1 2.277-1.12m0 0a18.06 18.06 0 0 1 3.223-.74m0 0a18.02 18.02 0 0 1 3.223.74m0 0a17.95 17.95 0 0 1 2.277 1.12m0 0c-.549.978-.95 2.018-1.19 3.088m0 0a17.95 17.95 0 0 1-2.277 1.12m0 0a18.06 18.06 0 0 1-3.223.74m0 0a18.02 18.02 0 0 1-3.223-.74m0 0a17.95 17.95 0 0 1-2.277-1.12M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918" />
              </svg>
              <span>প্রিন্ট / PDF</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
              title="এক্সেল সমর্থিত CSV ফাইলে ডাউনলোড করুন"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>এক্সেল / CSV</span>
            </button>
          </div>
        </div>

        {/* Report Selector Pills Bar */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase px-2 mb-2">প্রতিবেদনের ধরণ নির্বাচন করুন:</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {reportOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setReportType(opt.id)}
                className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  reportType === opt.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50/70 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="text-base mb-1">{opt.icon}</span>
                <span className={`text-xs font-bold leading-tight ${reportType === opt.id ? 'text-white' : 'text-slate-800'}`}>
                  {opt.nameBn}
                </span>
                <span className={`text-[10px] mt-0.5 truncate max-w-full ${reportType === opt.id ? 'text-blue-100' : 'text-slate-400'}`}>
                  {opt.nameEn}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Global Report Filters Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Month Picker (hidden when the dashboard owns the month) */}
            {!embedded && (
              <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-medium px-2">মাস:</span>
                <button
                  onClick={handlePrevMonth}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs"
                  title="পূর্ববর্তী মাস"
                >
                  ◀
                </button>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    const yr = Number(e.target.value.split('-')[0]);
                    if (yr) setSelectedYear(yr);
                    onMonthChange?.(e.target.value);
                  }}
                  className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1"
                />
                <button
                  onClick={handleNextMonth}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs"
                  title="পরবর্তী মাস"
                >
                  ▶
                </button>
              </div>
            )}

            {/* Year Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium px-2">বছর:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
          </div>

          {/* Contextual Filters: Property and Tenant */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Property Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">ভবন:</span>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-blue-500"
              >
                <option value="all">সকল ভবন (All Properties)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tenant Filter (relevant especially for tenant ledger) */}
            {reportType === 'tenant_ledger' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">ভাড়াটিয়া:</span>
                <select
                  value={effectiveTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-blue-500"
                >
                  {tenants.map((t) => {
                    const prop = properties.find((p) => p.id === t.propertyId);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({prop?.name || 'ভবন'} - {t.mobile})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          MAIN REPORT VIEW (Rendered based on selected reportType)
         ===================================================================== */}
      <main className="mt-4">
        {reportType === 'monthly_statement' && <MonthlyStatementView data={monthlyStatement} />}
        {reportType === 'yearly_summary' && <YearlySummaryView data={yearlySummary} />}
        {reportType === 'property_income' && <PropertyIncomeView data={propertyIncome} />}
        {reportType === 'property_expenses' && <PropertyExpenseView data={propertyExpense} />}
        {reportType === 'tenant_ledger' && <TenantLedgerView data={tenantLedger} />}
        {reportType === 'outstanding_rent' && <OutstandingRentView data={outstandingRent} />}
        {reportType === 'building_expenses' && <BuildingExpenseView data={buildingExpense} />}
        {reportType === 'family_expenses' && <FamilyExpenseView data={familyExpense} />}
        {reportType === 'family_distribution' && (
          <DistributionStatementView data={distributionStatement} />
        )}
        {reportType === 'reserve_fund' && <ReserveFundStatementView data={reserveFundStatement} />}
        {reportType === 'net_operating' && <NetOperatingStatementView data={netOperatingBalance} />}
        {reportType === 'budget_vs_actual' && <BudgetVsActualView data={budgetVsActual} />}
      </main>

      {/* Print footer */}
      <div className="print-only mt-8 pt-4 border-t border-slate-300 text-center text-xs text-slate-500">
        <p>ভূঁইয়া প্রপার্টি ম্যানেজার স্বত্বাধিকারী সংরক্ষণ ব্যবস্থা • অডিট রেকর্ড অপরিবর্তনীয়</p>
      </div>
    </div>
  );
};
