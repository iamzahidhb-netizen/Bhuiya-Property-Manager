import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Hourglass,
  ReceiptText,
  Scale,
  TrendingDown,
  Users,
  Wallet,
} from 'lucide-react';
import type { Property, Unit } from '../../types/property';
import type { Tenant } from '../../types/tenant';
import type { Expense, RentBill, RentPayment } from '../../types/finance';
import {
  calculateOperatingSummary,
  calculateRentBillSummary,
  getExpenseBillingMonth,
  getPaymentBillingMonth,
} from '../../services/financialSummary';
import { subtractMoney } from '../../utils/money';
import { formatLocalizedCurrency, formatLocalizedMonth } from '../../utils/banglaFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings } from '../../contexts/SettingsContext';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { HisabMetric } from './HisabUI';
import { resolveDateMonth, resolveActivityTimestamp } from './dateHelpers';
import RentModulePanel from './RentModulePanel';
import ExpenseModulePanel from './ExpenseModulePanel';
import DistributionModulePanel from './DistributionModulePanel';
import ReportsModulePanel from './ReportsModulePanel';

export type HisabTab = 'rent' | 'expenses' | 'distribution' | 'reports';

const TAB_ORDER: HisabTab[] = ['rent', 'expenses', 'distribution', 'reports'];

const TAB_ICONS = {
  rent: Wallet,
  expenses: ReceiptText,
  distribution: Scale,
  reports: BarChart3,
} as const;

export interface HisabDashboardProps {
  ownerUid: string;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  bills: RentBill[];
  payments: RentPayment[];
  expenses: Expense[];
  activeTab: HisabTab;
  onTabChange: (tab: HisabTab) => void;
  canCollectRent: boolean;
  canRecordExpenses: boolean;
  canAccessTab: (tabId: string) => boolean;
  onOpenRentDeposit: (tenantId?: string | null) => void;
  onOpenAddExpense: () => void;
  onOpenTenantDetails: (tenant: Tenant) => void;
  onCreateTenant: () => void;
  onOpenPropertyManagement: () => void;
  onOpenTenantManagement: () => void;
}

interface ActivityItem {
  id: string;
  kind: 'payment' | 'expense';
  title: string;
  subtitle: string;
  amount: number;
  timestamp: number;
}

/**
 * Interactive single-page Hisab (accounts) dashboard.
 *
 * Layout: compact monthly overview (month/year selector, property filter,
 * essential financial cards) followed by four interactive module tabs. Only
 * the selected module is rendered, so all four financial modules share one
 * responsive implementation across Web, PWA and the Capacitor Android shell.
 */
export default function HisabDashboard({
  ownerUid,
  properties,
  units,
  tenants,
  bills,
  payments,
  expenses,
  activeTab,
  onTabChange,
  canCollectRent,
  canRecordExpenses,
  canAccessTab,
  onOpenRentDeposit,
  onOpenAddExpense,
  onOpenTenantDetails,
  onCreateTenant,
  onOpenPropertyManagement,
  onOpenTenantManagement,
}: HisabDashboardProps) {
  const { currentLanguage, t } = useLanguage();
  const { settings } = useSettings();

  const useBanglaNumerals = settings.languageRegion.useBanglaNumerals;
  const isBn = currentLanguage === 'bn';

  const activeProperties = useMemo(
    () => properties.filter((property) => !property.isArchived),
    [properties]
  );
  const activeUnits = useMemo(() => units.filter((unit) => !unit.isArchived), [units]);
  const activeTenants = useMemo(
    () => tenants.filter((tenant) => tenant.status === 'active'),
    [tenants]
  );

  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [propertyId, setPropertyId] = useState<string>('all');

  // Ignore a stale property selection (archived/removed) so the filter can
  // never leave the dashboard showing an empty, unexplained dataset.
  const effectivePropertyId =
    propertyId === 'all' || activeProperties.some((property) => property.id === propertyId)
      ? propertyId
      : 'all';

  function shiftMonth(delta: number) {
    setMonth((current) => {
      const [yearStr, monthStr] = current.split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1 + delta;
      const nextDate = new Date(year, monthIndex, 1);
      return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    });
  }

  function goToCurrentMonth() {
    const now = new Date();
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }

  // Month + property scoped data. Financial totals reuse the shared
  // financialSummary helpers; no formula is re-implemented here.
  const scopedPayments = useMemo(
    () =>
      effectivePropertyId === 'all'
        ? payments
        : payments.filter((payment) => payment.propertyId === effectivePropertyId),
    [payments, effectivePropertyId]
  );

  const scopedExpenses = useMemo(
    () =>
      effectivePropertyId === 'all'
        ? expenses
        : expenses.filter((expense) => expense.propertyId === effectivePropertyId),
    [expenses, effectivePropertyId]
  );

  const scopedBills = useMemo(
    () =>
      effectivePropertyId === 'all'
        ? bills
        : bills.filter((bill) => bill.propertyId === effectivePropertyId),
    [bills, effectivePropertyId]
  );

  const operatingSummary = useMemo(
    () => calculateOperatingSummary(month, scopedPayments, scopedExpenses),
    [month, scopedPayments, scopedExpenses]
  );

  const monthBills = useMemo(
    () =>
      scopedBills.filter(
        (bill) => (bill.billingMonth || resolveDateMonth(bill.createdAt)) === month
      ),
    [scopedBills, month]
  );

  const rentSummary = useMemo(() => calculateRentBillSummary(monthBills), [monthBills]);

  // Family payout total is intentionally 0 while the staging financial write
  // lock is active; cash-in-hand therefore mirrors the existing home formula.
  const familyPayoutsTotal = 0;
  const cashInHand = subtractMoney(
    subtractMoney(operatingSummary.actualRentCollected, operatingSummary.totalActualExpenses),
    familyPayoutsTotal
  );

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const monthPayments = scopedPayments
      .filter(
        (payment) =>
          getPaymentBillingMonth(payment) === month && payment.entryType === 'payment'
      )
      .map<ActivityItem>((payment) => ({
        id: `payment-${payment.id}`,
        kind: 'payment',
        title: payment.tenantName || (isBn ? 'ভাড়া জমা' : 'Rent payment'),
        subtitle: `${t('hisab.paymentActivity')}${
          payment.receiptNumber ? ` • ${payment.receiptNumber}` : ''
        }${payment.paymentMethod ? ` • ${payment.paymentMethod}` : ''}`,
        amount: payment.amount,
        timestamp: resolveActivityTimestamp(payment.paymentDate || payment.createdAt),
      }));

    const monthExpenses = scopedExpenses
      .filter(
        (expense) =>
          getExpenseBillingMonth(expense) === month && expense.status === 'active'
      )
      .map<ActivityItem>((expense) => ({
        id: `expense-${expense.id}`,
        kind: 'expense',
        title: expense.title,
        subtitle: `${t('hisab.expenseActivity')} • ${expense.category}${
          expense.propertyName ? ` • ${expense.propertyName}` : ''
        }`,
        amount: expense.amount,
        timestamp: resolveActivityTimestamp(expense.expenseDate),
      }));

    return [...monthPayments, ...monthExpenses]
      .sort((first, second) => second.timestamp - first.timestamp)
      .slice(0, 6);
  }, [scopedPayments, scopedExpenses, month, isBn, t]);

  const formatCount = (value: number) =>
    useBanglaNumerals && isBn ? value.toLocaleString('bn-BD') : value.toLocaleString('en-US');

  const monthLabel = formatLocalizedMonth(month, currentLanguage);

  function selectTab(tab: HisabTab) {
    if (tab === activeTab) return;
    onTabChange(tab);
  }

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TAB_ORDER.length;
    else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    } else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TAB_ORDER.length - 1;
    else return;

    event.preventDefault();
    const nextTab = TAB_ORDER[nextIndex];
    selectTab(nextTab);
    if (typeof document !== 'undefined') {
      document.getElementById(`hisab-tab-${nextTab}`)?.focus();
    }
  }

  return (
    <div className="operations-view min-w-0 space-y-3.5 sm:space-y-4">
      {/* =================================================================== */}
      {/* COMPACT MONTHLY OVERVIEW                                            */}
      {/* =================================================================== */}
      <HyperCard className="space-y-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0">
            <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-[var(--hyper-green)]">
              {t('hisab.eyebrow')}
            </span>
            <h1 className="truncate text-base font-bold text-[var(--hyper-text-primary)] sm:text-lg">
              {t('hisab.title')}
            </h1>
            <p className="truncate text-[11px] font-medium text-[var(--hyper-text-secondary)] sm:text-xs">
              {t('hisab.subtitle')}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenPropertyManagement}
              aria-label={t('hisab.manageProperties')}
              title={t('hisab.manageProperties')}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-2.5 py-2 text-[11px] font-bold text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
            >
              <Building2 className="h-3.5 w-3.5 text-[var(--hyper-green)]" aria-hidden="true" />
              <span className="hidden sm:inline">{t('hisab.manageProperties')}</span>
            </button>
            <button
              type="button"
              onClick={onOpenTenantManagement}
              aria-label={t('hisab.manageTenants')}
              title={t('hisab.manageTenants')}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-2.5 py-2 text-[11px] font-bold text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
            >
              <Users className="h-3.5 w-3.5 text-[var(--hyper-green)]" aria-hidden="true" />
              <span className="hidden sm:inline">{t('hisab.manageTenants')}</span>
            </button>
          </div>
        </div>

        {/* Month + year selector and property filter */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label={t('hisab.prevMonth')}
              title={t('hisab.prevMonth')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="relative min-w-0 flex-1">
              <input
                type="month"
                value={month}
                onChange={(event) => {
                  if (event.target.value) setMonth(event.target.value);
                }}
                aria-label={t('hisab.monthLabel')}
                className="hyper-input-field min-h-10 w-full min-w-[140px] py-2 pl-3 pr-2 text-xs font-bold tabular-nums"
              />
            </div>

            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label={t('hisab.nextMonth')}
              title={t('hisab.nextMonth')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={goToCurrentMonth}
              aria-label={t('hisab.currentMonth')}
              title={t('hisab.currentMonth')}
              className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hyper-green-bg)] text-[var(--hyper-green)] transition-colors hover:brightness-105 cursor-pointer"
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-1.5">
            <Building2
              className="h-4 w-4 shrink-0 text-[var(--hyper-text-tertiary)]"
              aria-hidden="true"
            />
            <select
              value={effectivePropertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              aria-label={t('hisab.propertyLabel')}
              className="hyper-input-field min-h-10 w-full min-w-0 py-2 pl-3 pr-8 text-xs font-semibold"
            >
              <option value="all">{t('hisab.allProperties')}</option>
              {activeProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Essential financial summary cards */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <HisabMetric
            label={t('hisab.metrics.collected')}
            value={formatLocalizedCurrency(
              operatingSummary.actualRentCollected,
              currentLanguage,
              useBanglaNumerals
            )}
            hint={t('hisab.metricsHint.collected')}
            icon={ArrowDownLeft}
            tone="green"
          />
          <HisabMetric
            label={t('hisab.metrics.due')}
            value={formatLocalizedCurrency(rentSummary.totalDue, currentLanguage, useBanglaNumerals)}
            hint={t('hisab.metricsHint.due')}
            icon={Hourglass}
            tone="red"
          />
          <HisabMetric
            label={t('hisab.metrics.expenses')}
            value={formatLocalizedCurrency(
              operatingSummary.totalActualExpenses,
              currentLanguage,
              useBanglaNumerals
            )}
            hint={t('hisab.metricsHint.expenses')}
            icon={TrendingDown}
            tone="orange"
          />
          <HisabMetric
            label={t('hisab.metrics.cashInHand')}
            value={formatLocalizedCurrency(cashInHand, currentLanguage, useBanglaNumerals)}
            hint={t('hisab.metricsHint.cashInHand')}
            icon={Coins}
            tone={cashInHand >= 0 ? 'blue' : 'red'}
          />
        </div>

        <p className="truncate text-[10px] font-semibold text-[var(--hyper-text-tertiary)]">
          {monthLabel} • {formatCount(monthBills.length)} {t('hisab.module.bills')} •{' '}
          {formatCount(activeTenants.length)} {isBn ? 'সক্রিয় ভাড়াটিয়া' : 'active tenants'}
        </p>

      </HyperCard>

      {/* =================================================================== */}
      {/* FOUR INTERACTIVE MODULE TABS                                        */}
      {/* =================================================================== */}
      <div
        role="tablist"
        aria-label={t('hisab.tabsLabel')}
        aria-orientation="horizontal"
        className="grid grid-cols-4 gap-1 rounded-2xl border border-[var(--hyper-border)] bg-[var(--hyper-bg-card)] p-1 shadow-sm"
      >
        {TAB_ORDER.map((tab, index) => {
          const Icon = TAB_ICONS[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              id={`hisab-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`hisab-panel-${tab}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              title={t(`hisab.tabDescriptions.${tab}`)}
              className={`flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-bold transition-colors sm:gap-1.5 sm:text-xs cursor-pointer ${
                isActive
                  ? 'bg-[var(--hyper-green)] text-white shadow-sm'
                  : 'text-[var(--hyper-text-secondary)] hover:bg-[var(--hyper-bg-card-hover)] hover:text-[var(--hyper-text-primary)]'
              }`}
            >
              <Icon className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
              <span className="truncate">{t(`hisab.tabs.${tab}`)}</span>
            </button>
          );
        })}
      </div>

      {/* Only the selected module is mounted; modules are never stacked. */}
      <div
        key={activeTab}
        role="tabpanel"
        id={`hisab-panel-${activeTab}`}
        aria-labelledby={`hisab-tab-${activeTab}`}
        tabIndex={0}
        className="min-w-0 outline-none animate-in fade-in duration-200"
      >
        {activeTab === 'rent' && (
          <RentModulePanel
            ownerUid={ownerUid}
            month={month}
            propertyId={effectivePropertyId}
            properties={activeProperties}
            units={units}
            tenants={tenants}
            bills={bills}
            canCollectRent={canCollectRent}
            onOpenRentDeposit={onOpenRentDeposit}
            onOpenTenantDetails={onOpenTenantDetails}
            onCreateTenant={onCreateTenant}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpenseModulePanel
            month={month}
            propertyId={effectivePropertyId}
            properties={activeProperties}
            expenses={expenses}
            payments={payments}
            canRecordExpenses={canRecordExpenses}
          />
        )}

        {activeTab === 'distribution' && (
          <DistributionModulePanel
            ownerUid={ownerUid}
            month={month}
            onMonthChange={setMonth}
            enabled={canAccessTab('distribution')}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsModulePanel
            ownerUid={ownerUid}
            month={month}
            onMonthChange={setMonth}
            enabled={canAccessTab('reports')}
          />
        )}
      </div>

      {/* Quick financial action row keeps forms reachable from every module. */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpenRentDeposit(null)}
          disabled={!canCollectRent}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card)] px-3 py-2.5 text-[11px] font-bold text-[var(--hyper-text-primary)] shadow-sm transition-colors hover:bg-[var(--hyper-bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
        >
          <Wallet className="h-4 w-4 text-[var(--hyper-green)]" aria-hidden="true" />
          <span className="truncate">{t('accounts.cards.rentCollection.btn')}</span>
        </button>
        <button
          type="button"
          onClick={onOpenAddExpense}
          disabled={!canRecordExpenses}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card)] px-3 py-2.5 text-[11px] font-bold text-[var(--hyper-text-primary)] shadow-sm transition-colors hover:bg-[var(--hyper-bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
        >
          <ReceiptText className="h-4 w-4 text-[var(--hyper-green)]" aria-hidden="true" />
          <span className="truncate">{t('accounts.cards.expenses.btn')}</span>
        </button>
      </div>
        {/* Property & unit overview (collapsible secondary section) */}
        <details className="group rounded-2xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-3 py-2">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-bold text-[var(--hyper-text-primary)]">
            <span className="flex min-w-0 items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--hyper-green)]" aria-hidden="true" />
              <span className="truncate">{t('hisab.propertyOverview')}</span>
            </span>
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 text-[var(--hyper-text-secondary)] transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="min-w-0 rounded-xl bg-[var(--hyper-bg-card)] p-2 text-center">
              <span className="block truncate text-[10px] font-medium text-[var(--hyper-text-secondary)]">
                {t('hisab.units')}
              </span>
              <span className="block truncate text-sm font-bold tabular-nums text-[var(--hyper-text-primary)]">
                {formatCount(activeUnits.length)}
              </span>
            </div>
            <div className="min-w-0 rounded-xl bg-[var(--hyper-green-bg)] p-2 text-center">
              <span className="block truncate text-[10px] font-medium text-[var(--hyper-text-secondary)]">
                {t('hisab.occupied')}
              </span>
              <span className="block truncate text-sm font-bold tabular-nums text-[var(--hyper-green)]">
                {formatCount(activeTenants.length)}
              </span>
            </div>
            <div className="min-w-0 rounded-xl bg-[var(--hyper-bg-card)] p-2 text-center">
              <span className="block truncate text-[10px] font-medium text-[var(--hyper-text-secondary)]">
                {t('hisab.vacant')}
              </span>
              <span className="block truncate text-sm font-bold tabular-nums text-[var(--hyper-text-primary)]">
                {formatCount(Math.max(0, activeUnits.length - activeTenants.length))}
              </span>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onOpenPropertyManagement}
              className="min-h-9 flex-1 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
            >
              {t('hisab.manageProperties')}
            </button>
            <button
              type="button"
              onClick={onOpenTenantManagement}
              className="min-h-9 flex-1 rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
            >
              {t('hisab.manageTenants')}
            </button>
          </div>
        </details>

        {/* Recent activity (collapsible secondary section) */}
        <details className="group rounded-2xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-3 py-2">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-bold text-[var(--hyper-text-primary)]">
            <span className="flex min-w-0 items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--hyper-green)]" aria-hidden="true" />
              <span className="truncate">{t('hisab.activity')}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-full bg-[var(--hyper-bg-card)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--hyper-text-secondary)]">
                {formatCount(recentActivity.length)}
              </span>
              <ChevronDown
                className="h-3.5 w-3.5 text-[var(--hyper-text-secondary)] transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>

          {recentActivity.length === 0 ? (
            <p className="py-3 text-center text-[11px] font-medium text-[var(--hyper-text-secondary)]">
              {t('hisab.activityEmpty')}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--hyper-border-subtle)] pt-1">
              {recentActivity.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        item.kind === 'payment'
                          ? 'bg-[var(--hyper-green-bg)] text-[var(--hyper-green)]'
                          : 'bg-[var(--hyper-orange-bg)] text-[#C26A0E] dark:text-[#FBBF24]'
                      }`}
                    >
                      {item.kind === 'payment' ? (
                        <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-bold text-[var(--hyper-text-primary)]">
                        {item.title}
                      </span>
                      <span className="block truncate text-[10px] font-medium text-[var(--hyper-text-secondary)]">
                        {item.subtitle}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[11px] font-bold tabular-nums ${
                      item.kind === 'payment'
                        ? 'text-[#1E9E42] dark:text-[#4ADE80]'
                        : 'text-[#C26A0E] dark:text-[#FBBF24]'
                    }`}
                  >
                    {item.kind === 'payment' ? '+' : '−'}
                    {formatLocalizedCurrency(item.amount, currentLanguage, useBanglaNumerals)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
    </div>
  );
}
