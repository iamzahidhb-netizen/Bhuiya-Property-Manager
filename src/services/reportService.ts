import type {
  RentBill,
  RentPayment,
  Expense,
  FamilyDistribution,
  ReserveFundAccount,
  ReserveLedgerEntry,
  BuildingExpenseCategory,
  FamilyExpenseCategory,
} from '../types/finance';
import { MONTHLY_BUILDING_EXPENSE_BUDGET } from '../types/finance';
import {
  BUILDING_CATEGORY_LABELS,
  FAMILY_CATEGORY_LABELS,
} from './expenseService';
import { parseTimestampMillis, formatDateSafe } from '../utils/dhakaDate';
import type { Tenant } from '../types/tenant';
import type { Property } from '../types/property';
import type {
  MonthlyFinancialStatement,
  YearlyFinancialSummary,
  MonthlySummaryRow,
  PropertyIncomeReport,
  PropertyIncomeRow,
  PropertyExpenseReport,
  PropertyExpenseRow,
  TenantRentLedger,
  TenantLedgerEntry,
  OutstandingRentReport,
  OutstandingRentItem,
  BuildingExpenseReport,
  BuildingExpenseCategorySummary,
  FamilyExpenseReport,
  FamilyExpenseCategorySummary,
  FamilyDistributionStatement,
  DistributionBeneficiaryRow,
  ReserveFundStatement,
  NetOperatingBalanceReport,
  BudgetVsActualReport,
} from '../types/reports';

// Bengali month names
const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper to filter dates by month or custom range
export function isDateInFilter(
  dateStr: string | undefined | null,
  monthFilter: string,
  mode: 'monthly' | 'yearly' | 'custom',
  yearFilter?: number,
  startDate?: string,
  endDate?: string
): boolean {
  if (!dateStr) return false;
  if (mode === 'monthly') {
    return dateStr.startsWith(monthFilter);
  }
  if (mode === 'yearly') {
    const yr = String(yearFilter || dateStr.slice(0, 4));
    return dateStr.startsWith(yr);
  }
  if (mode === 'custom') {
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  }
  return true;
}

// =============================================================================
// 1. MONTHLY FINANCIAL STATEMENT
// =============================================================================
export function calculateMonthlyFinancialStatement(
  month: string,
  payments: RentPayment[],
  bills: RentBill[],
  expenses: Expense[],
  distribution: FamilyDistribution | null,
  tenants: Tenant[]
): MonthlyFinancialStatement {
  // Realized collections from rent_payments
  const monthPayments = payments.filter((p) => p.billingMonth === month);
  const totalOperatingIncome = monthPayments.reduce((acc, p) => acc + p.amount, 0);

  // Proportional breakdown from bills of this month
  const monthBills = bills.filter((b) => b.billingMonth === month);
  const totalBilled = monthBills.reduce((acc, b) => acc + b.totalDue, 0);
  const totalRentBilled = monthBills.reduce((acc, b) => acc + b.rentAmount, 0);
  const totalGasBilled = monthBills.reduce((acc, b) => acc + b.gasCharge, 0);
  const totalWaterBilled = monthBills.reduce((acc, b) => acc + b.waterCharge, 0);

  let actualRentalIncome = totalOperatingIncome;
  let actualGasIncome = 0;
  let actualWaterIncome = 0;
  let actualOtherIncome = 0;

  if (totalBilled > 0) {
    const ratio = totalOperatingIncome / totalBilled;
    actualRentalIncome = Math.round(totalRentBilled * ratio);
    actualGasIncome = Math.round(totalGasBilled * ratio);
    actualWaterIncome = Math.round(totalWaterBilled * ratio);
    actualOtherIncome = totalOperatingIncome - (actualRentalIncome + actualGasIncome + actualWaterIncome);
  }

  // Active expenses strictly excluding reversed
  const monthActiveExpenses = expenses.filter(
    (e) => e.billingMonth === month && e.status === 'active'
  );

  const buildingOperatingExpenses = monthActiveExpenses
    .filter((e) => e.group === 'building')
    .reduce((acc, e) => acc + e.amount, 0);

  const familySocialExpenses = monthActiveExpenses
    .filter((e) => e.group === 'family')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalOperatingExpenses = buildingOperatingExpenses + familySocialExpenses;
  const netOperatingSurplus = totalOperatingIncome - totalOperatingExpenses;

  // Distribution details
  const totalFamilyDistributionDisbursed = distribution?.actualTotalDisbursed || 0;
  const totalFamilyDistributionTarget = distribution?.finalTargetTotal || 0;
  const distributionPending = distribution?.remainingPendingTotal || 0;
  const reserveInflow = distribution?.reserveInflow || 0;
  const reserveOutflow = distribution?.surplusTransferredToReserve || 0;

  const endingCashBalance =
    netOperatingSurplus + reserveInflow - totalFamilyDistributionDisbursed - reserveOutflow;

  // Security deposits are liabilities
  const securityDepositsHeld = tenants
    .filter((t) => t.status === 'active')
    .reduce((acc, t) => acc + (t.advanceDeposit || 0), 0);

  return {
    month,
    actualRentalIncome,
    actualGasIncome,
    actualWaterIncome,
    actualOtherIncome,
    totalOperatingIncome,
    buildingOperatingExpenses,
    familySocialExpenses,
    totalOperatingExpenses,
    netOperatingSurplus,
    totalFamilyDistributionDisbursed,
    totalFamilyDistributionTarget,
    distributionPending,
    reserveInflow,
    reserveOutflow,
    endingCashBalance,
    securityDepositsHeld,
  };
}

// =============================================================================
// 2. YEARLY FINANCIAL SUMMARY
// =============================================================================
export function calculateYearlyFinancialSummary(
  year: number,
  payments: RentPayment[],
  expenses: Expense[],
  distributions: FamilyDistribution[]
): YearlyFinancialSummary {
  const months: MonthlySummaryRow[] = [];

  let totalOperatingIncome = 0;
  let totalBuildingExpenses = 0;
  let totalFamilyExpenses = 0;
  let totalExpenses = 0;
  let totalNetOperatingSurplus = 0;
  let totalDistributionDisbursed = 0;
  let totalReserveNetTransfer = 0;

  for (let m = 1; m <= 12; m++) {
    const monthStr = `${year}-${String(m).padStart(2, '0')}`;
    const monthPayments = payments.filter((p) => p.billingMonth === monthStr);
    const inc = monthPayments.reduce((acc, p) => acc + p.amount, 0);

    const monthActiveExpenses = expenses.filter(
      (e) => e.billingMonth === monthStr && e.status === 'active'
    );
    const bExp = monthActiveExpenses
      .filter((e) => e.group === 'building')
      .reduce((acc, e) => acc + e.amount, 0);
    const fExp = monthActiveExpenses
      .filter((e) => e.group === 'family')
      .reduce((acc, e) => acc + e.amount, 0);
    const totExp = bExp + fExp;
    const surplus = inc - totExp;

    const dist = distributions.find((d) => d.distributionMonth === monthStr);
    const distDisbursed = dist?.actualTotalDisbursed || 0;
    const resNet = (dist?.surplusTransferredToReserve || 0) - (dist?.reserveInflow || 0);

    months.push({
      month: monthStr,
      monthNameBn: BN_MONTHS[m - 1],
      monthNameEn: EN_MONTHS[m - 1],
      operatingIncome: inc,
      buildingExpenses: bExp,
      familyExpenses: fExp,
      totalExpenses: totExp,
      netOperatingSurplus: surplus,
      distributionDisbursed: distDisbursed,
      reserveNetTransfer: resNet,
    });

    totalOperatingIncome += inc;
    totalBuildingExpenses += bExp;
    totalFamilyExpenses += fExp;
    totalExpenses += totExp;
    totalNetOperatingSurplus += surplus;
    totalDistributionDisbursed += distDisbursed;
    totalReserveNetTransfer += resNet;
  }

  return {
    year,
    months,
    totalOperatingIncome,
    totalBuildingExpenses,
    totalFamilyExpenses,
    totalExpenses,
    totalNetOperatingSurplus,
    totalDistributionDisbursed,
    totalReserveNetTransfer,
    averageMonthlyIncome: Math.round(totalOperatingIncome / 12),
    averageMonthlyExpenses: Math.round(totalExpenses / 12),
  };
}

// =============================================================================
// 3. PROPERTY-WISE INCOME REPORT
// =============================================================================
export function calculatePropertyIncomeReport(
  periodLabel: string,
  properties: Property[],
  payments: RentPayment[],
  bills: RentBill[],
  selectedMonth?: string
): PropertyIncomeReport {
  let totalBilled = 0;
  let totalCollected = 0;
  let totalDue = 0;

  const rows: PropertyIncomeRow[] = properties
    .filter((p) => !p.isArchived)
    .map((prop) => {
      const propBills = bills.filter(
        (b) =>
          b.propertyId === prop.id &&
          (!selectedMonth || b.billingMonth === selectedMonth)
      );

      const propPayments = payments.filter(
        (p) =>
          p.propertyId === prop.id &&
          (!selectedMonth || p.billingMonth === selectedMonth)
      );

      const bTotal = propBills.reduce((acc, b) => acc + b.totalDue, 0);
      const cTotal = propPayments.reduce((acc, p) => acc + p.amount, 0);
      const dTotal = propBills.reduce((acc, b) => acc + b.balanceDue, 0);

      // Category breakdown
      const rentBilled = propBills.reduce((acc, b) => acc + b.rentAmount, 0);
      const gasBilled = propBills.reduce((acc, b) => acc + b.gasCharge, 0);
      const waterBilled = propBills.reduce((acc, b) => acc + b.waterCharge, 0);

      const ratio = bTotal > 0 ? cTotal / bTotal : 0;
      const rentCollected = Math.round(rentBilled * ratio);
      const gasCollected = Math.round(gasBilled * ratio);
      const waterCollected = Math.round(waterBilled * ratio);
      const otherCollected = cTotal - (rentCollected + gasCollected + waterCollected);

      const collectionRate = bTotal > 0 ? Math.min(100, Math.round((cTotal / bTotal) * 100)) : 100;

      totalBilled += bTotal;
      totalCollected += cTotal;
      totalDue += dTotal;

      return {
        propertyId: prop.id,
        propertyName: prop.name,
        totalUnits: Object.keys(prop.activeUnitNumbers || {}).length,
        occupiedUnits: Object.keys(prop.activeUnitNumbers || {}).length,
        rentCollected,
        gasCollected,
        waterCollected,
        otherCollected,
        totalCollected: cTotal,
        totalBilled: bTotal,
        totalDue: dTotal,
        collectionRate,
      };
    });

  const overallCollectionRate =
    totalBilled > 0 ? Math.min(100, Math.round((totalCollected / totalBilled) * 100)) : 100;

  return {
    periodLabel,
    properties: rows,
    totalBilled,
    totalCollected,
    totalDue,
    overallCollectionRate,
  };
}

// =============================================================================
// 4. PROPERTY-WISE EXPENSE REPORT
// =============================================================================
export function calculatePropertyExpenseReport(
  periodLabel: string,
  properties: Property[],
  expenses: Expense[],
  selectedMonth?: string
): PropertyExpenseReport {
  const activeExpenses = expenses.filter(
    (e) =>
      e.group === 'building' &&
      e.status === 'active' &&
      (!selectedMonth || e.billingMonth === selectedMonth)
  );

  const totalBuildingExpenses = activeExpenses.reduce((acc, e) => acc + e.amount, 0);

  const rows: PropertyExpenseRow[] = [];

  // Group by existing active properties
  properties
    .filter((p) => !p.isArchived)
    .forEach((prop) => {
      const pExp = activeExpenses.filter((e) => e.propertyId === prop.id);
      const electricity = pExp.filter((e) => e.category === 'electricity').reduce((acc, e) => acc + e.amount, 0);
      const gas = pExp.filter((e) => e.category === 'gas').reduce((acc, e) => acc + e.amount, 0);
      const water = pExp.filter((e) => e.category === 'water').reduce((acc, e) => acc + e.amount, 0);
      const caretaker = pExp.filter((e) => e.category === 'caretaker_salary').reduce((acc, e) => acc + e.amount, 0);
      const maintenance = pExp.filter((e) => e.category === 'maintenance_repair').reduce((acc, e) => acc + e.amount, 0);
      const cleaning = pExp.filter((e) => e.category === 'cleaning').reduce((acc, e) => acc + e.amount, 0);
      const security = pExp.filter((e) => e.category === 'security').reduce((acc, e) => acc + e.amount, 0);
      const otherBuilding = pExp.filter((e) => e.category === 'other_building').reduce((acc, e) => acc + e.amount, 0);
      const tot = pExp.reduce((acc, e) => acc + e.amount, 0);

      rows.push({
        propertyId: prop.id,
        propertyName: prop.name,
        electricity,
        gas,
        water,
        caretaker,
        maintenance,
        cleaning,
        security,
        otherBuilding,
        totalPropertyExpense: tot,
        percentageOfTotal: totalBuildingExpenses > 0 ? Math.round((tot / totalBuildingExpenses) * 100) : 0,
      });
    });

  // Shared / General expenses without property attribution
  const sharedExp = activeExpenses.filter((e) => !e.propertyId);
  if (sharedExp.length > 0) {
    const electricity = sharedExp.filter((e) => e.category === 'electricity').reduce((acc, e) => acc + e.amount, 0);
    const gas = sharedExp.filter((e) => e.category === 'gas').reduce((acc, e) => acc + e.amount, 0);
    const water = sharedExp.filter((e) => e.category === 'water').reduce((acc, e) => acc + e.amount, 0);
    const caretaker = sharedExp.filter((e) => e.category === 'caretaker_salary').reduce((acc, e) => acc + e.amount, 0);
    const maintenance = sharedExp.filter((e) => e.category === 'maintenance_repair').reduce((acc, e) => acc + e.amount, 0);
    const cleaning = sharedExp.filter((e) => e.category === 'cleaning').reduce((acc, e) => acc + e.amount, 0);
    const security = sharedExp.filter((e) => e.category === 'security').reduce((acc, e) => acc + e.amount, 0);
    const otherBuilding = sharedExp.filter((e) => e.category === 'other_building').reduce((acc, e) => acc + e.amount, 0);
    const tot = sharedExp.reduce((acc, e) => acc + e.amount, 0);

    rows.push({
      propertyId: 'shared',
      propertyName: 'সাধারণ / অবণ্টনযোগ্য ভবন খরচ (General/Shared)',
      electricity,
      gas,
      water,
      caretaker,
      maintenance,
      cleaning,
      security,
      otherBuilding,
      totalPropertyExpense: tot,
      percentageOfTotal: totalBuildingExpenses > 0 ? Math.round((tot / totalBuildingExpenses) * 100) : 0,
    });
  }

  return {
    periodLabel,
    rows,
    totalBuildingExpenses,
  };
}

// =============================================================================
// 5. TENANT-WISE RENT LEDGER
// =============================================================================
export function calculateTenantRentLedger(
  tenant: Tenant,
  bills: RentBill[],
  payments: RentPayment[]
): TenantRentLedger {
  const tenantBills = bills.filter((b) => b.tenantId === tenant.id);
  const tenantPayments = payments.filter((p) => p.tenantId === tenant.id);

  const entries: TenantLedgerEntry[] = [];

  // Add bills
  tenantBills.forEach((b) => {
    entries.push({
      id: `bill_${b.id}`,
      date: b.dueDate || b.billingMonth + '-01',
      type: 'bill',
      billingMonth: b.billingMonth,
      description: `${b.billingMonth} মাসের ভাড়া ও ইউটিলিটি বিল`,
      billedRent: b.rentAmount,
      billedGas: b.gasCharge,
      billedWater: b.waterCharge,
      totalBilled: b.totalDue,
      amountPaid: 0,
      balanceDue: b.balanceDue,
      notes: b.notes,
    });
  });

  // Add payments
  tenantPayments.forEach((p) => {
    const payDate = formatDateSafe(p.paymentDate || p.createdAt, p.billingMonth ? p.billingMonth + '-05' : '');

    entries.push({
      id: `pay_${p.id}`,
      date: payDate,
      type: 'payment',
      billingMonth: p.billingMonth,
      description: `${p.billingMonth} মাসের ভাড়া পরিশোধ`,
      billedRent: 0,
      billedGas: 0,
      billedWater: 0,
      totalBilled: 0,
      amountPaid: p.amount,
      balanceDue: 0,
      paymentMethod: p.paymentMethod,
      receiptNumber: p.receiptNumber,
      transactionId: p.transactionId || undefined,
      notes: p.notes,
    });
  });

  // Sort chronologically
  entries.sort((a, b) => a.date.localeCompare(b.date));

  const totalBilled = tenantBills.reduce((acc, b) => acc + b.totalDue, 0);
  const totalPaid = tenantPayments.reduce((acc, p) => acc + p.amount, 0);
  const totalOutstandingDue = Math.max(0, totalBilled - totalPaid);

  const firstBill = tenantBills[0];
  const propertyName = firstBill?.propertyName || 'প্রপার্টি';
  const unitNumber = firstBill?.unitNumber || 'ইউনিট';

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantPhone: tenant.mobile,
    propertyName,
    unitNumber,
    entries,
    totalBilled,
    totalPaid,
    totalOutstandingDue,
    securityDepositHeld: tenant.advanceDeposit || 0,
  };
}

// =============================================================================
// 6. OUTSTANDING RENT REPORT
// =============================================================================
export function calculateOutstandingRentReport(
  periodLabel: string,
  bills: RentBill[],
  selectedMonth?: string,
  propertyId?: string
): OutstandingRentReport {
  const unpaidBills = bills.filter((b) => {
    if (b.status === 'paid' || b.balanceDue <= 0) return false;
    if (selectedMonth && b.billingMonth !== selectedMonth) return false;
    if (propertyId && propertyId !== 'all' && b.propertyId !== propertyId) return false;
    return true;
  });

  const now = new Date();
  const items: OutstandingRentItem[] = unpaidBills.map((b) => {
    let daysOverdue = 0;
    if (b.dueDate) {
      const due = new Date(b.dueDate);
      const diff = now.getTime() - due.getTime();
      daysOverdue = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }

    return {
      billId: b.id,
      tenantId: b.tenantId,
      tenantName: b.tenantName,
      tenantPhone: b.tenantMobile,
      propertyId: b.propertyId,
      propertyName: b.propertyName,
      unitNumber: b.unitNumber,
      billingMonth: b.billingMonth,
      dueDate: b.dueDate || 'N/A',
      totalDue: b.totalDue,
      totalPaid: b.totalPaid,
      balanceDue: b.balanceDue,
      status: b.status,
      daysOverdue,
    };
  });

  // Sort highest balance due first
  items.sort((a, b) => b.balanceDue - a.balanceDue);

  const totalOverdueAmount = items.reduce((acc, i) => acc + i.balanceDue, 0);
  const overdueBillsCount = items.length;
  const uniqueTenants = new Set(items.map((i) => i.tenantId));

  return {
    periodLabel,
    items,
    totalOverdueAmount,
    overdueBillsCount,
    affectedTenantsCount: uniqueTenants.size,
  };
}

// =============================================================================
// 7. BUILDING OPERATING EXPENSE REPORT
// =============================================================================
export function calculateBuildingExpenseReport(
  periodLabel: string,
  expenses: Expense[],
  selectedMonth?: string,
  propertyId?: string
): BuildingExpenseReport {
  const filtered = expenses.filter((e) => {
    if (e.group !== 'building') return false;
    if (selectedMonth && e.billingMonth !== selectedMonth) return false;
    if (propertyId && propertyId !== 'all' && e.propertyId !== propertyId) return false;
    return true;
  });

  const active = filtered.filter((e) => e.status === 'active');
  const reversed = filtered.filter((e) => e.status === 'reversed');

  const totalBuildingExpenses = active.reduce((acc, e) => acc + e.amount, 0);
  const reversedAmountExcluded = reversed.reduce((acc, e) => acc + e.amount, 0);

  const categories: BuildingExpenseCategorySummary[] = Object.keys(
    BUILDING_CATEGORY_LABELS
  ).map((catKey) => {
    const cat = catKey as BuildingExpenseCategory;
    const catExpenses = active.filter((e) => e.category === cat);
    const totalAmount = catExpenses.reduce((acc, e) => acc + e.amount, 0);
    const entryCount = catExpenses.length;
    const percentageOfTotal =
      totalBuildingExpenses > 0 ? Math.round((totalAmount / totalBuildingExpenses) * 100) : 0;

    return {
      category: cat,
      categoryLabelBn: BUILDING_CATEGORY_LABELS[cat].bn,
      categoryLabelEn: BUILDING_CATEGORY_LABELS[cat].en,
      totalAmount,
      entryCount,
      percentageOfTotal,
    };
  });

  // Sort highest amount first
  categories.sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    periodLabel,
    categories,
    totalBuildingExpenses,
    activeEntriesCount: active.length,
    reversedEntriesCount: reversed.length,
    reversedAmountExcluded,
  };
}

// =============================================================================
// 8. FAMILY & SOCIAL EXPENSE REPORT
// =============================================================================
export function calculateFamilyExpenseReport(
  periodLabel: string,
  expenses: Expense[],
  selectedMonth?: string
): FamilyExpenseReport {
  const active = expenses.filter(
    (e) =>
      e.group === 'family' &&
      e.status === 'active' &&
      (!selectedMonth || e.billingMonth === selectedMonth)
  );

  const totalFamilyExpenses = active.reduce((acc, e) => acc + e.amount, 0);

  const categories: FamilyExpenseCategorySummary[] = Object.keys(
    FAMILY_CATEGORY_LABELS
  ).map((catKey) => {
    const cat = catKey as FamilyExpenseCategory;
    const catExpenses = active.filter((e) => e.category === cat);
    const totalAmount = catExpenses.reduce((acc, e) => acc + e.amount, 0);
    const entryCount = catExpenses.length;
    const percentageOfTotal =
      totalFamilyExpenses > 0 ? Math.round((totalAmount / totalFamilyExpenses) * 100) : 0;

    return {
      category: cat,
      categoryLabelBn: FAMILY_CATEGORY_LABELS[cat].bn,
      categoryLabelEn: FAMILY_CATEGORY_LABELS[cat].en,
      totalAmount,
      entryCount,
      percentageOfTotal,
    };
  });

  // Sort highest amount first
  categories.sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    periodLabel,
    categories,
    totalFamilyExpenses,
    activeEntriesCount: active.length,
  };
}

// =============================================================================
// 9. FAMILY DISTRIBUTION STATEMENT
// =============================================================================
export function calculateDistributionStatement(
  distribution: FamilyDistribution | null
): FamilyDistributionStatement {
  if (!distribution) {
    return {
      distributionMonth: 'N/A',
      status: 'none',
      beneficiaries: [],
      totalBaseTarget: 0,
      totalSpecialAdjustments: 0,
      finalTargetTotal: 0,
      actualTotalDisbursed: 0,
      remainingPendingTotal: 0,
      payoutRecords: [],
    };
  }

  const relBnMap: Record<string, string> = {
    brother: 'ভাই',
    mother: 'মা',
    sister: 'বোন',
    other: 'অন্যান্য',
  };

  const beneficiaries: DistributionBeneficiaryRow[] = (
    distribution.beneficiarySnapshots || []
  ).map((snap) => ({
    beneficiaryId: snap.beneficiaryId,
    name: snap.name,
    relationship: snap.relationship,
    relationshipLabelBn: relBnMap[snap.relationship] || snap.relationship,
    baseMonthlyTarget: snap.baseMonthlyTarget,
    specialAdjustment: snap.specialAdjustment || 0,
    adjustmentReason: snap.adjustmentReason || undefined,
    effectiveTarget: snap.effectiveTarget,
    actualDisbursed: snap.actualDisbursed || 0,
    pendingAmount: snap.pendingAmount || 0,
    payoutStatus: snap.payoutStatus || 'unpaid',
    payoutCount: (snap.payouts || []).length,
  }));

  const payoutRecords: FamilyDistributionStatement['payoutRecords'] = [];
  (distribution.beneficiarySnapshots || []).forEach((snap) => {
    (snap.payouts || []).forEach((p) => {
      payoutRecords.push({
        id: p.id,
        beneficiaryName: snap.name,
        amount: p.amount,
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod,
        transactionId: p.transactionId || undefined,
        notes: p.notes || undefined,
      });
    });
  });

  payoutRecords.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  return {
    distributionMonth: distribution.distributionMonth,
    status: distribution.status,
    beneficiaries,
    totalBaseTarget: distribution.calculatedTargetTotal || 0,
    totalSpecialAdjustments: distribution.specialAdjustmentTotal || 0,
    finalTargetTotal: distribution.finalTargetTotal || 0,
    actualTotalDisbursed: distribution.actualTotalDisbursed || 0,
    remainingPendingTotal: distribution.remainingPendingTotal || 0,
    payoutRecords,
  };
}

// =============================================================================
// 10. RESERVE FUND STATEMENT
// =============================================================================
export function calculateReserveFundStatement(
  fund: ReserveFundAccount | null,
  ledger: ReserveLedgerEntry[],
  selectedMonth?: string
): ReserveFundStatement {
  const currentBalance = fund?.currentBalance || 0;
  const totalDeposited = fund?.totalDeposited || 0;
  const totalWithdrawn = fund?.totalWithdrawn || 0;

  const typeBnMap: Record<string, string> = {
    opening_balance: 'প্রারম্ভিক তহবিল (Opening)',
    surplus_deposit: 'উদ্বৃত্ত জমা (Surplus Deposit)',
    shortage_withdrawal: 'ঘাটতি পূরণ উত্তোলন (Shortage)',
    emergency_withdrawal: 'জরুরি উত্তোলন (Emergency)',
  };

  const filtered = selectedMonth
    ? ledger.filter((l) => !l.distributionMonth || l.distributionMonth === selectedMonth)
    : ledger;

  const depositsInPeriod = filtered
    .filter((l) => l.type === 'surplus_deposit' || l.type === 'opening_balance')
    .reduce((acc, l) => acc + l.amount, 0);

  const withdrawalsInPeriod = filtered
    .filter((l) => l.type === 'shortage_withdrawal' || l.type === 'emergency_withdrawal')
    .reduce((acc, l) => acc + l.amount, 0);

  // Chronological sort
  const sorted = [...filtered].sort((a, b) => {
    const timeA = parseTimestampMillis(a.createdAt);
    const timeB = parseTimestampMillis(b.createdAt);
    return timeB - timeA;
  });

  const ledgerEntries = sorted.map((l) => {
    const date = formatDateSafe(l.createdAt, 'N/A');
    return {
      id: l.id,
      date,
      type: l.type,
      typeLabelBn: typeBnMap[l.type] || l.type,
      amount: l.amount,
      balanceBefore: l.balanceBefore,
      balanceAfter: l.balanceAfter,
      reason: l.reason,
      distributionMonth: l.distributionMonth || undefined,
      isRentalIncome: false as const,
    };
  });

  return {
    currentBalance,
    totalDeposited,
    totalWithdrawn,
    openingBalanceForPeriod: currentBalance - depositsInPeriod + withdrawalsInPeriod,
    depositsInPeriod,
    withdrawalsInPeriod,
    closingBalanceForPeriod: currentBalance,
    ledgerEntries,
  };
}

// =============================================================================
// 11. MONTHLY NET OPERATING BALANCE (CASH FLOW STATEMENT)
// =============================================================================
export function calculateNetOperatingBalance(
  month: string,
  statement: MonthlyFinancialStatement
): NetOperatingBalanceReport {
  const operatingSurplusOrDeficit = statement.netOperatingSurplus;
  const totalDisbursablePool = Math.max(
    0,
    operatingSurplusOrDeficit + statement.reserveInflow
  );

  return {
    month,
    actualRentalIncome: statement.actualRentalIncome,
    actualGasIncome: statement.actualGasIncome,
    actualWaterIncome: statement.actualWaterIncome,
    totalCollectedIncome: statement.totalOperatingIncome,
    buildingOperatingExpenses: statement.buildingOperatingExpenses,
    familySocialExpenses: statement.familySocialExpenses,
    totalExpensesDeducted: statement.totalOperatingExpenses,
    operatingSurplusOrDeficit,
    reserveInflow: statement.reserveInflow,
    totalDisbursablePool,
    actualDisbursedToFamily: statement.totalFamilyDistributionDisbursed,
    surplusTransferredToReserve: statement.reserveOutflow,
    unallocatedClosingCash: statement.endingCashBalance,
  };
}

// =============================================================================
// 12. BUDGET VS ACTUAL EXPENSE REPORT
// =============================================================================
export function calculateBudgetVsActualReport(
  month: string,
  expenses: Expense[]
): BudgetVsActualReport {
  const budgetTarget = MONTHLY_BUILDING_EXPENSE_BUDGET; // ৳60,000

  const activeBuildingExpenses = expenses.filter(
    (e) => e.billingMonth === month && e.group === 'building' && e.status === 'active'
  );

  const actualBuildingExpense = activeBuildingExpenses.reduce((acc, e) => acc + e.amount, 0);
  const varianceAmount = budgetTarget - actualBuildingExpense;
  const variancePercentage =
    budgetTarget > 0 ? Math.round(((actualBuildingExpense - budgetTarget) / budgetTarget) * 100) : 0;

  let status: BudgetVsActualReport['status'] = 'on_budget';
  if (varianceAmount > 0) {
    status = 'under_budget';
  } else if (varianceAmount < 0) {
    status = 'over_budget';
  }

  const categoryBreakdown = Object.keys(BUILDING_CATEGORY_LABELS).map((catKey) => {
    const cat = catKey as BuildingExpenseCategory;
    const catExpenses = activeBuildingExpenses.filter((e) => e.category === cat);
    const actualAmount = catExpenses.reduce((acc, e) => acc + e.amount, 0);
    const percentageOfActual =
      actualBuildingExpense > 0 ? Math.round((actualAmount / actualBuildingExpense) * 100) : 0;

    return {
      category: cat,
      categoryLabelBn: BUILDING_CATEGORY_LABELS[cat].bn,
      categoryLabelEn: BUILDING_CATEGORY_LABELS[cat].en,
      actualAmount,
      percentageOfActual,
    };
  });

  categoryBreakdown.sort((a, b) => b.actualAmount - a.actualAmount);

  return {
    month,
    budgetTarget,
    actualBuildingExpense,
    varianceAmount,
    variancePercentage,
    status,
    categoryBreakdown,
  };
}
