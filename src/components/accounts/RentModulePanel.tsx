import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  FilePlus2,
  History,
  ReceiptText,
  Users,
  Wallet,
} from 'lucide-react';
import type { Property, Unit } from '../../types/property';
import type { Tenant } from '../../types/tenant';
import type { BillStatus, RentBill, RentPayment } from '../../types/finance';
import { calculateRentBillSummary } from '../../services/financialSummary';
import { sumMoney } from '../../utils/money';
import { formatLocalizedCurrency } from '../../utils/banglaFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAppNavigation } from '../../contexts/NavigationContext';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { StatusBadge } from '../ui/hyperos/StatusBadge';
import GenerateBillsModal from '../rent/GenerateBillsModal';
import RecordPaymentModal from '../rent/RecordPaymentModal';
import RentReceiptModal from '../rent/RentReceiptModal';
import TenantHistoryModal from '../rent/TenantHistoryModal';
import type { GenerateBillsResult, RecordPaymentResult } from '../../services/rentService';
import {
  HisabEmptyState,
  HisabFilterChip,
  HisabMetric,
  HisabPagination,
  HisabSearchInput,
  HisabSection,
} from './HisabUI';
import { usePagination } from './usePagination';
import { resolveDateMonth } from './dateHelpers';

interface RentModulePanelProps {
  ownerUid: string;
  month: string;
  propertyId: string;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  bills: RentBill[];
  canCollectRent: boolean;
  onOpenRentDeposit: (tenantId?: string | null) => void;
  onOpenTenantDetails: (tenant: Tenant) => void;
  onCreateTenant: () => void;
}

const STATUS_TONE = {
  paid: 'success',
  partial: 'warning',
  unpaid: 'danger',
} as const;

export default function RentModulePanel({
  ownerUid,
  month,
  propertyId,
  properties,
  units,
  tenants,
  bills,
  canCollectRent,
  onOpenRentDeposit,
  onOpenTenantDetails,
  onCreateTenant,
}: RentModulePanelProps) {
  const { currentLanguage, t } = useLanguage();
  const { settings } = useSettings();
  const { registerBackGuard } = useAppNavigation();

  const useBanglaNumerals = settings.languageRegion.useBanglaNumerals;
  const isBn = currentLanguage === 'bn';

  const [statusFilter, setStatusFilter] = useState<BillStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantQuery, setTenantQuery] = useState('');

  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [paymentModalBill, setPaymentModalBill] = useState<RentBill | null>(null);
  const [historyModalTenant, setHistoryModalTenant] = useState<Tenant | null>(null);
  const [receiptModalPayment, setReceiptModalPayment] = useState<RentPayment | null>(null);
  const [receiptModalBill, setReceiptModalBill] = useState<RentBill | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Android hardware back / browser back closes any open rent workflow first.
  const isAnyModalOpen =
    generateModalOpen ||
    paymentModalBill !== null ||
    historyModalTenant !== null ||
    receiptModalPayment !== null;

  useEffect(() => {
    if (!isAnyModalOpen) return;
    return registerBackGuard({
      id: 'hisab-rent-module-modals',
      isDirty: () => isAnyModalOpen,
      onBlocked: () => {
        setGenerateModalOpen(false);
        setPaymentModalBill(null);
        setHistoryModalTenant(null);
        setReceiptModalPayment(null);
        setReceiptModalBill(null);
      },
    });
  }, [isAnyModalOpen, registerBackGuard]);

  // Bills for the selected month and property filter (dashboard-owned filters).
  const monthBills = useMemo(
    () =>
      bills.filter(
        (bill) =>
          (bill.billingMonth || resolveDateMonth(bill.createdAt)) === month &&
          (propertyId === 'all' || bill.propertyId === propertyId)
      ),
    [bills, month, propertyId]
  );

  // Legacy bills can have empty denormalized display fields; resolve the
  // current tenant/unit/property names when that happens (display only).
  const tenantById = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant])),
    [tenants]
  );
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const propertyById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties]
  );

  const billTenantName = (bill: RentBill) =>
    bill.tenantName || tenantById.get(bill.tenantId)?.name || '—';
  const billUnitNumber = (bill: RentBill) =>
    bill.unitNumber || unitById.get(bill.unitId)?.unitNumber || '—';
  const billPropertyName = (bill: RentBill) =>
    bill.propertyName || propertyById.get(bill.propertyId)?.name || '';

  const filteredBills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return monthBills.filter((bill) => {
      if (statusFilter !== 'all' && bill.status !== statusFilter) return false;
      if (!query) return true;
      const tenant = tenantById.get(bill.tenantId);
      return (
        bill.tenantName.toLowerCase().includes(query) ||
        (tenant?.name || '').toLowerCase().includes(query) ||
        bill.unitNumber.toLowerCase().includes(query) ||
        (unitById.get(bill.unitId)?.unitNumber || '').toLowerCase().includes(query) ||
        bill.tenantMobile.includes(query) ||
        (tenant?.mobile || '').includes(query) ||
        bill.propertyName.toLowerCase().includes(query) ||
        (propertyById.get(bill.propertyId)?.name || '').toLowerCase().includes(query)
      );
    });
  }, [monthBills, statusFilter, searchQuery, tenantById, unitById, propertyById]);

  // Financial totals always come from the full month/property set, never from
  // the paginated or search-filtered slice.
  const rentSummary = useMemo(() => calculateRentBillSummary(monthBills), [monthBills]);
  const collectionRate =
    rentSummary.totalDemand > 0
      ? Math.round((rentSummary.totalCollected / rentSummary.totalDemand) * 100)
      : 0;

  const countPaid = monthBills.filter((bill) => bill.status === 'paid').length;
  const countPartial = monthBills.filter((bill) => bill.status === 'partial').length;
  const countUnpaid = monthBills.filter((bill) => bill.status === 'unpaid').length;

  const propertySummaries = useMemo(() => {
    const map = new Map<
      string,
      { propertyName: string; demand: number; collected: number; due: number; billsCount: number }
    >();

    properties.forEach((property) => {
      map.set(property.id, {
        propertyName: property.name,
        demand: 0,
        collected: 0,
        due: 0,
        billsCount: 0,
      });
    });

    monthBills.forEach((bill) => {
      const entry = map.get(bill.propertyId) || {
        propertyName: bill.propertyName || propertyById.get(bill.propertyId)?.name || '',
        demand: 0,
        collected: 0,
        due: 0,
        billsCount: 0,
      };
      entry.demand = sumMoney([entry.demand, bill.totalDue]);
      entry.collected = sumMoney([entry.collected, bill.totalPaid]);
      entry.due = sumMoney([entry.due, bill.balanceDue]);
      entry.billsCount += 1;
      map.set(bill.propertyId, entry);
    });

    return Array.from(map.entries())
      .map(([id, data]) => ({
        propertyId: id,
        ...data,
        rate: data.demand > 0 ? Math.round((data.collected / data.demand) * 100) : 0,
      }))
      .filter((item) => item.billsCount > 0 || propertyId === 'all');
  }, [properties, monthBills, propertyId, propertyById]);

  const activeTenants = useMemo(() => {
    const query = tenantQuery.trim().toLowerCase();
    return tenants.filter((tenant) => {
      if (tenant.status !== 'active') return false;
      if (propertyId !== 'all' && tenant.propertyId !== propertyId) return false;
      if (!query) return true;
      const unit = units.find((unitItem) => unitItem.id === tenant.unitId);
      return (
        tenant.name.toLowerCase().includes(query) ||
        tenant.mobile.includes(query) ||
        (unit?.unitNumber || '').toLowerCase().includes(query)
      );
    });
  }, [tenants, units, propertyId, tenantQuery]);

  function getTenantMonthStatus(tenant: Tenant) {
    const bill = monthBills.find((item) => item.tenantId === tenant.id);
    const paid = bill ? bill.totalPaid : 0;
    const due = bill ? bill.balanceDue : tenant.monthlyRent || 0;
    const isPaid = bill?.status === 'paid' || (due === 0 && paid > 0);
    const isPartial = paid > 0 && due > 0;
    return { paid, due, isPaid, isPartial };
  }

  const billsPagination = usePagination(
    filteredBills,
    8,
    `${month}|${propertyId}|${statusFilter}|${searchQuery}`
  );
  const tenantsPagination = usePagination(
    activeTenants,
    5,
    `${month}|${propertyId}|${tenantQuery}`
  );

  const paginationLabels = {
    page: t('hisab.module.page'),
    of: t('hisab.module.of'),
    prev: t('hisab.module.prevPage'),
    next: t('hisab.module.nextPage'),
    showing: t('hisab.module.showing'),
    items: t('hisab.module.items'),
    total: t('hisab.module.total'),
  };

  const formatCount = (value: number) =>
    useBanglaNumerals && isBn ? value.toLocaleString('bn-BD') : value.toLocaleString('en-US');

  function handleBillGenerated(result: GenerateBillsResult) {
    setToastMessage(
      isBn
        ? `মাসিক বিল তৈরি হয়েছে — নতুন: ${formatCount(result.countCreated)} টি, স্কিপ: ${formatCount(
            result.countSkipped
          )} টি, মোট দাবি: ${formatLocalizedCurrency(
            result.totalAmountBilled,
            currentLanguage,
            useBanglaNumerals
          )}`
        : `Monthly bills generated — created: ${formatCount(
            result.countCreated
          )}, skipped: ${formatCount(result.countSkipped)}, total demand: ${formatLocalizedCurrency(
            result.totalAmountBilled,
            currentLanguage,
            useBanglaNumerals
          )}`
    );
    window.setTimeout(() => setToastMessage(null), 7000);
  }

  function handlePaymentRecorded(result: RecordPaymentResult) {
    const newPayment: RentPayment = {
      id: result.paymentId,
      ownerUid,
      billId: paymentModalBill?.id || '',
      propertyId: paymentModalBill?.propertyId || '',
      propertyName: result.propertyName,
      unitId: paymentModalBill?.unitId || '',
      unitNumber: result.unitNumber,
      tenantId: paymentModalBill?.tenantId || '',
      tenantName: result.tenantName,
      billingMonth: result.billingMonth,
      amount: result.amount,
      paymentMethod: 'cash',
      receiptNumber: result.receiptNumber,
      notes: '',
      entryType: 'payment',
      paymentDate: null,
      createdAt: null,
    };

    setToastMessage(
      isBn
        ? `পেমেন্ট গৃহীত — রসিদ: ${result.receiptNumber}, পরিমাণ: ${formatLocalizedCurrency(
            result.amount,
            currentLanguage,
            useBanglaNumerals
          )}, অবশিষ্ট বকেয়া: ${formatLocalizedCurrency(
            result.balanceDue,
            currentLanguage,
            useBanglaNumerals
          )}`
        : `Payment recorded — receipt: ${result.receiptNumber}, amount: ${formatLocalizedCurrency(
            result.amount,
            currentLanguage,
            useBanglaNumerals
          )}, balance due: ${formatLocalizedCurrency(
            result.balanceDue,
            currentLanguage,
            useBanglaNumerals
          )}`
    );
    window.setTimeout(() => setToastMessage(null), 7000);

    setPaymentModalBill(null);
    setReceiptModalPayment(newPayment);
    setReceiptModalBill(paymentModalBill);
  }

  function openTenantHistory(bill: RentBill) {
    const associatedTenant = tenants.find((tenant) => tenant.id === bill.tenantId);
    if (associatedTenant) {
      setHistoryModalTenant(associatedTenant);
      return;
    }
    setHistoryModalTenant({
      id: bill.tenantId,
      ownerUid,
      propertyId: bill.propertyId,
      unitId: bill.unitId,
      name: billTenantName(bill),
      mobile: bill.tenantMobile,
      monthlyRent: bill.rentAmount,
      gasCharge: bill.gasCharge,
      waterCharge: bill.waterCharge,
      advanceDeposit: 0,
      moveInDate: '',
      status: 'active',
      createdAt: null,
      updatedAt: null,
    });
  }

  const statusLabel = (status: BillStatus) =>
    status === 'paid'
      ? t('hisab.module.statusPaid')
      : status === 'partial'
        ? t('hisab.module.statusPartial')
        : t('hisab.module.statusUnpaid');

  return (
    <div className="space-y-3.5 sm:space-y-4 min-w-0">
      {toastMessage && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--hyper-green)]/25 bg-[var(--hyper-green-bg)] p-3 text-xs font-semibold text-[var(--hyper-text-primary)]">
          <span className="min-w-0 flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--hyper-green)]" />
            <span className="min-w-0 break-words">{toastMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="shrink-0 rounded-lg px-2 py-1 text-[var(--hyper-green)] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            aria-label={isBn ? 'বন্ধ করুন' : 'Dismiss'}
          >
            ✕
          </button>
        </div>
      )}

      {/* Module header + financial summary */}
      <HyperCard className="space-y-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-[var(--hyper-text-primary)] sm:text-base">
              {t('hisab.module.rentTitle')}
            </h2>
            <p className="truncate text-[11px] font-medium text-[var(--hyper-text-secondary)] sm:text-xs">
              {t('hisab.module.rentSubtitle')}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setGenerateModalOpen(true)}
              disabled={!canCollectRent}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-3 py-2 text-[11px] font-bold text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            >
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('hisab.module.generateBills')}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenRentDeposit(null)}
              disabled={!canCollectRent}
              className="flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--hyper-green)] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            >
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('hisab.module.collectRent')}</span>
            </button>
          </div>
        </div>

        {!canCollectRent && (
          <p className="rounded-xl bg-[var(--hyper-orange-bg)] px-3 py-2 text-[11px] font-semibold text-[var(--hyper-text-primary)]">
            {t('hisab.readOnly')}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <HisabMetric
            label={t('hisab.module.demand')}
            value={formatLocalizedCurrency(rentSummary.totalDemand, currentLanguage, useBanglaNumerals)}
            hint={`${formatCount(monthBills.length)} ${t('hisab.module.bills')}`}
            icon={ReceiptText}
            tone="blue"
          />
          <HisabMetric
            label={t('hisab.module.collected')}
            value={formatLocalizedCurrency(
              rentSummary.totalCollected,
              currentLanguage,
              useBanglaNumerals
            )}
            hint={t('hisab.metricsHint.collected')}
            icon={Wallet}
            tone="green"
          />
          <HisabMetric
            label={t('hisab.module.due')}
            value={formatLocalizedCurrency(rentSummary.totalDue, currentLanguage, useBanglaNumerals)}
            hint={`${formatCount(countUnpaid + countPartial)} ${t('hisab.module.bills')}`}
            icon={History}
            tone="red"
          />
          <HisabMetric
            label={t('hisab.module.rate')}
            value={`${formatCount(collectionRate)}%`}
            hint={`${formatCount(countPaid)}/${formatCount(monthBills.length)} ${t('hisab.module.statusPaid')}`}
            icon={Building2}
            tone="purple"
          />
        </div>
      </HyperCard>

      {/* Status filter + search */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label={t('hisab.module.filterStatus')}
        >
          <HisabFilterChip
            label={t('hisab.module.statusAll')}
            count={monthBills.length}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <HisabFilterChip
            label={t('hisab.module.statusUnpaid')}
            count={countUnpaid}
            active={statusFilter === 'unpaid'}
            onClick={() => setStatusFilter('unpaid')}
          />
          <HisabFilterChip
            label={t('hisab.module.statusPartial')}
            count={countPartial}
            active={statusFilter === 'partial'}
            onClick={() => setStatusFilter('partial')}
          />
          <HisabFilterChip
            label={t('hisab.module.statusPaid')}
            count={countPaid}
            active={statusFilter === 'paid'}
            onClick={() => setStatusFilter('paid')}
          />
        </div>

        <HisabSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('hisab.module.searchRent')}
          label={t('hisab.module.searchRent')}
          className="sm:max-w-xs"
        />
      </div>

      {/* Bill list */}
      <HyperCard className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hyper-border-subtle)] px-3.5 py-2.5">
          <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
            {t('hisab.module.rentTitle')}
          </span>
          <span className="text-[11px] font-semibold text-[var(--hyper-text-secondary)]">
            {formatCount(filteredBills.length)} / {formatCount(monthBills.length)}{' '}
            {t('hisab.module.bills')}
          </span>
        </div>

        {filteredBills.length === 0 ? (
          <div className="p-3">
            <HisabEmptyState
              icon={ReceiptText}
              title={monthBills.length === 0 ? t('hisab.module.noBills') : t('hisab.module.noResults')}
              description={
                monthBills.length === 0
                  ? t('hisab.module.noBillsHint')
                  : t('hisab.module.noResultsHint')
              }
              action={
                monthBills.length === 0 && canCollectRent ? (
                  <button
                    type="button"
                    onClick={() => setGenerateModalOpen(true)}
                    className="mt-1 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--hyper-green)] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:brightness-105 cursor-pointer"
                  >
                    <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                    {t('hisab.module.generateBills')}
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <ul className="divide-y divide-[var(--hyper-border-subtle)] lg:hidden">
              {billsPagination.pageItems.map((bill) => (
                <li key={bill.id} className="space-y-2.5 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--hyper-text-primary)]">
                        {billTenantName(bill)}
                      </p>
                      <p className="truncate text-[11px] font-medium text-[var(--hyper-text-secondary)]">
                        {billPropertyName(bill)} • {billUnitNumber(bill)}
                      </p>
                    </div>
                    <StatusBadge tone={STATUS_TONE[bill.status]}>{statusLabel(bill.status)}</StatusBadge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--hyper-bg-card-subtle)] px-2.5 py-2 text-[10px]">
                    <div className="min-w-0">
                      <span className="block truncate text-[var(--hyper-text-secondary)]">
                        {t('hisab.module.demand')}
                      </span>
                      <span className="block truncate font-bold tabular-nums text-[var(--hyper-text-primary)]">
                        {formatLocalizedCurrency(bill.totalDue, currentLanguage, useBanglaNumerals)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-[var(--hyper-text-secondary)]">
                        {t('hisab.module.paid')}
                      </span>
                      <span className="block truncate font-bold tabular-nums text-[#1E9E42] dark:text-[#4ADE80]">
                        {formatLocalizedCurrency(bill.totalPaid, currentLanguage, useBanglaNumerals)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-[var(--hyper-text-secondary)]">
                        {t('hisab.module.remaining')}
                      </span>
                      <span className="block truncate font-bold tabular-nums text-[#D64545] dark:text-[#F87171]">
                        {formatLocalizedCurrency(bill.balanceDue, currentLanguage, useBanglaNumerals)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[10px] font-medium text-[var(--hyper-text-tertiary)]">
                      {[
                        `${isBn ? 'ভাড়া' : 'Rent'}: ${formatLocalizedCurrency(
                          bill.rentAmount,
                          currentLanguage,
                          useBanglaNumerals
                        )}`,
                        bill.gasCharge > 0
                          ? `${isBn ? 'গ্যাস' : 'Gas'}: ${formatLocalizedCurrency(
                              bill.gasCharge,
                              currentLanguage,
                              useBanglaNumerals
                            )}`
                          : null,
                        bill.waterCharge > 0
                          ? `${isBn ? 'পানি' : 'Water'}: ${formatLocalizedCurrency(
                              bill.waterCharge,
                              currentLanguage,
                              useBanglaNumerals
                            )}`
                          : null,
                        bill.serviceCharge > 0
                          ? `${isBn ? 'সার্ভিস' : 'Service'}: ${formatLocalizedCurrency(
                              bill.serviceCharge,
                              currentLanguage,
                              useBanglaNumerals
                            )}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {bill.balanceDue > 0 && (
                        <button
                          type="button"
                          onClick={() => setPaymentModalBill(bill)}
                          disabled={!canCollectRent}
                          className="min-h-9 rounded-lg bg-[var(--hyper-green)] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                        >
                          {t('hisab.module.recordPayment')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openTenantHistory(bill)}
                        className="min-h-9 rounded-lg border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-3 py-1.5 text-[11px] font-bold text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
                      >
                        {t('hisab.module.receiptHistory')}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] text-[11px] font-semibold uppercase tracking-wide text-[var(--hyper-text-secondary)]">
                  <tr>
                    <th className="px-3.5 py-2.5">
                      {isBn ? 'ভাড়াটিয়া ও ইউনিট' : 'Tenant & unit'}
                    </th>
                    <th className="px-3.5 py-2.5">
                      {isBn ? 'চার্জের বিবরণ' : 'Charge breakdown'}
                    </th>
                    <th className="px-3.5 py-2.5 text-right">{t('hisab.module.demand')}</th>
                    <th className="px-3.5 py-2.5 text-right">{t('hisab.module.paid')}</th>
                    <th className="px-3.5 py-2.5 text-right">{t('hisab.module.remaining')}</th>
                    <th className="px-3.5 py-2.5 text-center">{t('hisab.module.filterStatus')}</th>
                    <th className="px-3.5 py-2.5 text-right">
                      {isBn ? 'অ্যাকশন' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hyper-border-subtle)]">
                  {billsPagination.pageItems.map((bill) => (
                    <tr
                      key={bill.id}
                      className="transition-colors hover:bg-[var(--hyper-bg-card-hover)]"
                    >
                      <td className="px-3.5 py-2.5">
                        <p className="font-bold text-[var(--hyper-text-primary)]">{billTenantName(bill)}</p>
                        <p className="text-[11px] text-[var(--hyper-text-secondary)]">
                          {billPropertyName(bill)} • {billUnitNumber(bill)}
                          {bill.tenantMobile ? ` • ${bill.tenantMobile}` : ''}
                        </p>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-[var(--hyper-text-secondary)]">
                        {[
                          `${isBn ? 'ভাড়া' : 'Rent'} ${formatLocalizedCurrency(
                            bill.rentAmount,
                            currentLanguage,
                            useBanglaNumerals
                          )}`,
                          bill.gasCharge > 0
                            ? `${isBn ? 'গ্যাস' : 'Gas'} ${formatLocalizedCurrency(
                                bill.gasCharge,
                                currentLanguage,
                                useBanglaNumerals
                              )}`
                            : null,
                          bill.waterCharge > 0
                            ? `${isBn ? 'পানি' : 'Water'} ${formatLocalizedCurrency(
                                bill.waterCharge,
                                currentLanguage,
                                useBanglaNumerals
                              )}`
                            : null,
                          bill.serviceCharge > 0
                            ? `${isBn ? 'সার্ভিস' : 'Service'} ${formatLocalizedCurrency(
                                bill.serviceCharge,
                                currentLanguage,
                                useBanglaNumerals
                              )}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold tabular-nums text-[var(--hyper-text-primary)]">
                        {formatLocalizedCurrency(bill.totalDue, currentLanguage, useBanglaNumerals)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums text-[#1E9E42] dark:text-[#4ADE80]">
                        {formatLocalizedCurrency(bill.totalPaid, currentLanguage, useBanglaNumerals)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold tabular-nums text-[#D64545] dark:text-[#F87171]">
                        {formatLocalizedCurrency(bill.balanceDue, currentLanguage, useBanglaNumerals)}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <StatusBadge tone={STATUS_TONE[bill.status]}>
                          {statusLabel(bill.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {bill.balanceDue > 0 && (
                            <button
                              type="button"
                              onClick={() => setPaymentModalBill(bill)}
                              disabled={!canCollectRent}
                              className="rounded-lg bg-[var(--hyper-green)] px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                            >
                              {t('hisab.module.recordPayment')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openTenantHistory(bill)}
                            className="rounded-lg border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
                          >
                            {t('hisab.module.receiptHistory')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[var(--hyper-border-subtle)] px-3.5 py-2.5">
              <HisabPagination
                page={billsPagination.page}
                pageCount={billsPagination.pageCount}
                total={billsPagination.total}
                rangeStart={billsPagination.rangeStart}
                rangeEnd={billsPagination.rangeEnd}
                canPrev={billsPagination.canPrev}
                canNext={billsPagination.canNext}
                onPrev={billsPagination.goPrev}
                onNext={billsPagination.goNext}
                labels={paginationLabels}
              />
            </div>
          </>
        )}
      </HyperCard>

      {/* Property-wise collection summary */}
      <HisabSection
        title={t('hisab.module.propertySummary')}
        subtitle={`${formatCount(propertySummaries.length)} ${isBn ? 'প্রপার্টি' : 'properties'}`}
        icon={Building2}
      >
        {propertySummaries.length === 0 ? (
          <p className="py-3 text-center text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'কোনো প্রপার্টি তথ্য নেই।' : 'No property data available.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--hyper-text-secondary)]">
                <tr>
                  <th className="px-2 py-2">{t('hisab.propertyLabel')}</th>
                  <th className="px-2 py-2 text-center">{t('hisab.module.bills')}</th>
                  <th className="px-2 py-2 text-right">{t('hisab.module.demand')}</th>
                  <th className="px-2 py-2 text-right">{t('hisab.module.collected')}</th>
                  <th className="px-2 py-2 text-right">{t('hisab.module.due')}</th>
                  <th className="px-2 py-2 text-center">{t('hisab.module.rate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hyper-border-subtle)]">
                {propertySummaries.map((property) => (
                  <tr key={property.propertyId}>
                    <td className="px-2 py-2 font-bold text-[var(--hyper-text-primary)]">
                      {property.propertyName}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums text-[var(--hyper-text-secondary)]">
                      {formatCount(property.billsCount)}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-[var(--hyper-text-primary)]">
                      {formatLocalizedCurrency(property.demand, currentLanguage, useBanglaNumerals)}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-[#1E9E42] dark:text-[#4ADE80]">
                      {formatLocalizedCurrency(property.collected, currentLanguage, useBanglaNumerals)}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-[#D64545] dark:text-[#F87171]">
                      {formatLocalizedCurrency(property.due, currentLanguage, useBanglaNumerals)}
                    </td>
                    <td className="px-2 py-2 text-center font-bold tabular-nums text-[var(--hyper-text-primary)]">
                      {formatCount(property.rate)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HisabSection>

      {/* Tenants & current month status */}
      <HisabSection
        title={t('hisab.module.tenantsSection')}
        subtitle={`${formatCount(activeTenants.length)} ${isBn ? 'সক্রিয় ভাড়াটিয়া' : 'active tenants'}`}
        icon={Users}
      >
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <HisabSearchInput
              value={tenantQuery}
              onChange={setTenantQuery}
              placeholder={t('hisab.module.tenantSearch')}
              label={t('hisab.module.tenantSearch')}
            />
            <button
              type="button"
              onClick={onCreateTenant}
              className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-3 py-2 text-[11px] font-bold text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
            >
              + {t('hisab.module.addTenant')}
            </button>
          </div>

          {activeTenants.length === 0 ? (
            <p className="py-3 text-center text-xs text-[var(--hyper-text-secondary)]">
              {t('dashboard.noTenants')}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-[var(--hyper-border-subtle)]">
                {tenantsPagination.pageItems.map((tenant) => {
                  const status = getTenantMonthStatus(tenant);
                  const unit = units.find((unitItem) => unitItem.id === tenant.unitId);
                  return (
                    <li key={tenant.id} className="flex flex-wrap items-center gap-2 py-2.5">
                      <button
                        type="button"
                        onClick={() => onOpenTenantDetails(tenant)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--hyper-green-bg)] text-sm font-bold text-[var(--hyper-green)]">
                          {tenant.name.slice(0, 1)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-[var(--hyper-text-primary)]">
                            {tenant.name}
                          </span>
                          <span className="block truncate text-[11px] font-medium text-[var(--hyper-text-secondary)]">
                            {unit?.unitNumber || '—'} •{' '}
                            {formatLocalizedCurrency(
                              tenant.monthlyRent,
                              currentLanguage,
                              useBanglaNumerals
                            )}
                          </span>
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <StatusBadge
                          tone={status.isPaid ? 'success' : status.isPartial ? 'warning' : 'danger'}
                        >
                          {status.isPaid
                            ? t('dashboard.statusPaid')
                            : status.isPartial
                              ? t('dashboard.statusPartial')
                              : t('dashboard.statusDue')}
                        </StatusBadge>
                        <button
                          type="button"
                          onClick={() => onOpenRentDeposit(tenant.id)}
                          disabled={!canCollectRent}
                          className="min-h-9 rounded-lg bg-[var(--hyper-green)] px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                        >
                          {t('dashboard.collectRentAction')}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <HisabPagination
                page={tenantsPagination.page}
                pageCount={tenantsPagination.pageCount}
                total={tenantsPagination.total}
                rangeStart={tenantsPagination.rangeStart}
                rangeEnd={tenantsPagination.rangeEnd}
                canPrev={tenantsPagination.canPrev}
                canNext={tenantsPagination.canNext}
                onPrev={tenantsPagination.goPrev}
                onNext={tenantsPagination.goNext}
                labels={paginationLabels}
              />
            </>
          )}
        </div>
      </HisabSection>

      {/* Workflow modals */}
      <GenerateBillsModal
        key={month}
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        properties={properties}
        defaultMonth={month}
        onSuccess={handleBillGenerated}
      />

      <RecordPaymentModal
        isOpen={paymentModalBill !== null}
        onClose={() => setPaymentModalBill(null)}
        bill={paymentModalBill}
        onSuccess={handlePaymentRecorded}
      />

      <RentReceiptModal
        isOpen={receiptModalPayment !== null}
        onClose={() => {
          setReceiptModalPayment(null);
          setReceiptModalBill(null);
        }}
        payment={receiptModalPayment}
        bill={receiptModalBill}
      />

      <TenantHistoryModal
        isOpen={historyModalTenant !== null}
        onClose={() => setHistoryModalTenant(null)}
        tenant={historyModalTenant}
        ownerUid={ownerUid}
        onSelectReceipt={(payment, bill) => {
          setReceiptModalPayment(payment);
          setReceiptModalBill(bill);
        }}
      />
    </div>
  );
}
