import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ClipboardList,
  Coins,
  Landmark,
  Plus,
  ReceiptText,
  Users,
} from 'lucide-react';
import type { Property } from '../../types/property';
import type { Expense, ExpenseCategory, ExpenseGroup, RentPayment } from '../../types/finance';
import { calculateOperatingSummary, EXPENSE_CATEGORY_LABELS } from '../../services/expenseService';
import { getExpenseBillingMonth } from '../../services/financialSummary';
import { sumMoney } from '../../utils/money';
import { formatLocalizedCurrency } from '../../utils/banglaFormat';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAppNavigation } from '../../contexts/NavigationContext';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { StatusBadge } from '../ui/hyperos/StatusBadge';
import ExpenseModal from '../expenses/ExpenseModal';
import ExpenseDetailsModal from '../expenses/ExpenseDetailsModal';
import {
  HisabEmptyState,
  HisabFilterChip,
  HisabMetric,
  HisabPagination,
  HisabSearchInput,
  HisabSection,
} from './HisabUI';
import { usePagination } from './usePagination';

interface ExpenseModulePanelProps {
  month: string;
  propertyId: string;
  properties: Property[];
  expenses: Expense[];
  payments: RentPayment[];
  canRecordExpenses: boolean;
}

export default function ExpenseModulePanel({
  month,
  propertyId,
  properties,
  expenses,
  payments,
  canRecordExpenses,
}: ExpenseModulePanelProps) {
  const { currentLanguage, t } = useLanguage();
  const { settings } = useSettings();
  const { registerBackGuard } = useAppNavigation();

  const useBanglaNumerals = settings.languageRegion.useBanglaNumerals;
  const isBn = currentLanguage === 'bn';

  const [groupFilter, setGroupFilter] = useState<ExpenseGroup | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [detailsExpense, setDetailsExpense] = useState<Expense | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAnyModalOpen = modalOpen || detailsExpense !== null;

  useEffect(() => {
    if (!isAnyModalOpen) return;
    return registerBackGuard({
      id: 'hisab-expense-module-modals',
      isDirty: () => isAnyModalOpen,
      onBlocked: () => {
        setModalOpen(false);
        setEditingExpense(null);
        setDetailsExpense(null);
      },
    });
  }, [isAnyModalOpen, registerBackGuard]);

  const scopedExpenses = useMemo(
    () =>
      propertyId === 'all'
        ? expenses
        : expenses.filter((expense) => expense.propertyId === propertyId),
    [expenses, propertyId]
  );

  const scopedPayments = useMemo(
    () =>
      propertyId === 'all'
        ? payments
        : payments.filter((payment) => payment.propertyId === propertyId),
    [payments, propertyId]
  );

  // Same operating-summary calculation used by the existing expense module.
  const operatingSummary = useMemo(
    () => calculateOperatingSummary(month, scopedPayments, scopedExpenses),
    [month, scopedPayments, scopedExpenses]
  );

  const monthExpenses = useMemo(
    () =>
      scopedExpenses
        .filter((expense) => getExpenseBillingMonth(expense) === month)
        .sort((a, b) => {
          if (a.expenseDate === b.expenseDate) return a.title.localeCompare(b.title);
          return b.expenseDate.localeCompare(a.expenseDate);
        }),
    [scopedExpenses, month]
  );

  const filteredExpenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return monthExpenses.filter((expense) => {
      if (groupFilter !== 'all' && expense.group !== groupFilter) return false;
      if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;
      if (!query) return true;
      return (
        expense.title.toLowerCase().includes(query) ||
        (expense.paidTo || '').toLowerCase().includes(query) ||
        (expense.description || '').toLowerCase().includes(query) ||
        (expense.propertyName || '').toLowerCase().includes(query)
      );
    });
  }, [monthExpenses, groupFilter, categoryFilter, searchQuery]);

  const propertyExpenseSummaries = useMemo(() => {
    const map = new Map<string, { propertyName: string; totalAmount: number; count: number }>();

    properties.forEach((property) => {
      map.set(property.id, { propertyName: property.name, totalAmount: 0, count: 0 });
    });

    monthExpenses
      .filter(
        (expense) =>
          expense.group === 'building' && expense.status === 'active' && Boolean(expense.propertyId)
      )
      .forEach((expense) => {
        const entry = map.get(expense.propertyId as string) || {
          propertyName: expense.propertyName || 'Property',
          totalAmount: 0,
          count: 0,
        };
        entry.totalAmount = sumMoney([entry.totalAmount, expense.amount]);
        entry.count += 1;
        map.set(expense.propertyId as string, entry);
      });

    return Array.from(map.entries())
      .map(([id, data]) => ({ propertyId: id, ...data }))
      .filter((item) => item.count > 0 || propertyId === 'all');
  }, [properties, monthExpenses, propertyId]);

  const pagination = usePagination(
    filteredExpenses,
    8,
    `${month}|${propertyId}|${groupFilter}|${categoryFilter}|${searchQuery}`
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

  const categoryLabel = (category: ExpenseCategory) =>
    isBn
      ? EXPENSE_CATEGORY_LABELS[category]?.bn || category
      : EXPENSE_CATEGORY_LABELS[category]?.en || category;

  const groupLabel = (group: ExpenseGroup) =>
    group === 'building' ? t('hisab.module.groupBuilding') : t('hisab.module.groupFamily');

  const countBuilding = monthExpenses.filter((expense) => expense.group === 'building').length;
  const countFamily = monthExpenses.filter((expense) => expense.group === 'family').length;

  function openCreateModal() {
    setEditingExpense(null);
    setModalOpen(true);
  }

  function openEditModal(expense: Expense) {
    setEditingExpense(expense);
    setModalOpen(true);
  }

  return (
    <div className="min-w-0 space-y-3.5 sm:space-y-4">
      {toastMessage && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--hyper-green)]/25 bg-[var(--hyper-green-bg)] p-3 text-xs font-semibold text-[var(--hyper-text-primary)]">
          <span className="min-w-0 break-words">{toastMessage}</span>
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

      {/* Module header + summary */}
      <HyperCard className="space-y-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-[var(--hyper-text-primary)] sm:text-base">
              {t('hisab.module.expenseTitle')}
            </h2>
            <p className="truncate text-[11px] font-medium text-[var(--hyper-text-secondary)] sm:text-xs">
              {t('hisab.module.expenseSubtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canRecordExpenses}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--hyper-green)] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('hisab.module.addExpense')}</span>
          </button>
        </div>

        {!canRecordExpenses && (
          <p className="rounded-xl bg-[var(--hyper-orange-bg)] px-3 py-2 text-[11px] font-semibold text-[var(--hyper-text-primary)]">
            {t('hisab.readOnly')}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <HisabMetric
            label={t('hisab.module.totalExpenses')}
            value={formatLocalizedCurrency(
              operatingSummary.totalActualExpenses,
              currentLanguage,
              useBanglaNumerals
            )}
            hint={`${formatCount(monthExpenses.filter((item) => item.status === 'active').length)} ${
              t('hisab.module.entries')
            }`}
            icon={ReceiptText}
            tone="red"
          />
          <HisabMetric
            label={t('hisab.module.buildingExpenses')}
            value={formatLocalizedCurrency(
              operatingSummary.buildingExpenses,
              currentLanguage,
              useBanglaNumerals
            )}
            hint={`${formatCount(countBuilding)} ${t('hisab.module.entries')}`}
            icon={Building2}
            tone="blue"
          />
          <HisabMetric
            label={t('hisab.module.familyExpenses')}
            value={formatLocalizedCurrency(
              operatingSummary.familyExpenses,
              currentLanguage,
              useBanglaNumerals
            )}
            hint={`${formatCount(countFamily)} ${t('hisab.module.entries')}`}
            icon={Users}
            tone="green"
          />
          <HisabMetric
            label={t('hisab.module.budget')}
            value={`${formatCount(operatingSummary.budgetUtilizationPercent)}%`}
            hint={t('hisab.module.budgetHint')}
            icon={Landmark}
            tone={
              operatingSummary.budgetUtilizationPercent > 100 ? 'red' : 'orange'
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[var(--hyper-bg-card-subtle)] px-3 py-2 text-[11px] font-medium">
          <span className="truncate text-[var(--hyper-text-secondary)]">
            {t('hisab.module.collected')}
          </span>
          <span className="ml-2 shrink-0 font-bold tabular-nums text-[#1E9E42] dark:text-[#4ADE80]">
            {formatLocalizedCurrency(
              operatingSummary.actualRentCollected,
              currentLanguage,
              useBanglaNumerals
            )}
          </span>
        </div>
      </HyperCard>

      {/* Group + category + search filters */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label={isBn ? 'খরচের ধরন' : 'Expense group'}
          >
            <HisabFilterChip
              label={t('hisab.module.groupAll')}
              count={monthExpenses.length}
              active={groupFilter === 'all'}
              onClick={() => setGroupFilter('all')}
            />
            <HisabFilterChip
              label={t('hisab.module.groupBuilding')}
              count={countBuilding}
              active={groupFilter === 'building'}
              onClick={() => setGroupFilter('building')}
            />
            <HisabFilterChip
              label={t('hisab.module.groupFamily')}
              count={countFamily}
              active={groupFilter === 'family'}
              onClick={() => setGroupFilter('family')}
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as ExpenseCategory | 'all')
              }
              aria-label={t('hisab.module.categoryAll')}
              className="hyper-input-field min-h-10 min-w-0 flex-1 py-2 pl-3 pr-8 text-xs font-semibold sm:max-w-[190px]"
            >
              <option value="all">{t('hisab.module.categoryAll')}</option>
              {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <HisabSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('hisab.module.searchExpense')}
          label={t('hisab.module.searchExpense')}
        />
      </div>

      {/* Expense list */}
      <HyperCard className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--hyper-border-subtle)] px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--hyper-text-primary)]">
            <ClipboardList className="h-3.5 w-3.5 text-[var(--hyper-green)]" aria-hidden="true" />
            {isBn ? 'খরচের তালিকা' : 'Expense list'}
          </span>
          <span className="text-[11px] font-semibold text-[var(--hyper-text-secondary)]">
            {formatCount(filteredExpenses.length)} / {formatCount(monthExpenses.length)}{' '}
            {t('hisab.module.entries')}
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-3">
            <HisabEmptyState
              icon={Coins}
              title={
                monthExpenses.length === 0 ? t('hisab.module.noExpenses') : t('hisab.module.noResults')
              }
              description={
                monthExpenses.length === 0
                  ? t('hisab.module.noExpensesHint')
                  : t('hisab.module.noResultsHint')
              }
              action={
                monthExpenses.length === 0 && canRecordExpenses ? (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-1 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--hyper-green)] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:brightness-105 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {t('hisab.module.addExpense')}
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-[var(--hyper-border-subtle)] lg:hidden">
              {pagination.pageItems.map((expense) => (
                <li key={expense.id} className="space-y-2 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-bold ${
                          expense.status === 'reversed'
                            ? 'text-[var(--hyper-text-tertiary)] line-through'
                            : 'text-[var(--hyper-text-primary)]'
                        }`}
                      >
                        {expense.title}
                      </p>
                      <p className="truncate text-[11px] font-medium text-[var(--hyper-text-secondary)]">
                        {expense.expenseDate} • {categoryLabel(expense.category)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--hyper-text-primary)]">
                      {formatLocalizedCurrency(expense.amount, currentLanguage, useBanglaNumerals)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <StatusBadge tone={expense.group === 'building' ? 'info' : 'success'}>
                        {groupLabel(expense.group)}
                      </StatusBadge>
                      <StatusBadge tone={expense.status === 'reversed' ? 'danger' : 'neutral'}>
                        {expense.status === 'reversed'
                          ? isBn
                            ? 'বাতিল'
                            : 'Reversed'
                          : isBn
                            ? 'সক্রিয়'
                            : 'Active'}
                      </StatusBadge>
                      {expense.auditHistory?.length > 0 && (
                        <span className="text-[10px] font-semibold text-[#C26A0E] dark:text-[#FBBF24]">
                          {isBn
                            ? `${formatCount(expense.auditHistory.length)} বার সংশোধিত`
                            : `edited ${formatCount(expense.auditHistory.length)}×`}
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailsExpense(expense)}
                        className="min-h-9 rounded-lg border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
                      >
                        {t('hisab.module.auditDetails')}
                      </button>
                      {expense.status === 'active' && canRecordExpenses && (
                        <button
                          type="button"
                          onClick={() => openEditModal(expense)}
                          className="min-h-9 rounded-lg bg-[var(--hyper-bg-card-subtle)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--hyper-green)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
                        >
                          {t('hisab.module.edit')}
                        </button>
                      )}
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
                    <th className="px-3.5 py-2.5">{isBn ? 'তারিখ' : 'Date'}</th>
                    <th className="px-3.5 py-2.5">{isBn ? 'শিরোনাম' : 'Title'}</th>
                    <th className="px-3.5 py-2.5">{isBn ? 'ধরন' : 'Group'}</th>
                    <th className="px-3.5 py-2.5">{isBn ? 'প্রপার্টি / প্রাপক' : 'Property / payee'}</th>
                    <th className="px-3.5 py-2.5 text-right">{isBn ? 'পরিমাণ' : 'Amount'}</th>
                    <th className="px-3.5 py-2.5 text-center">{isBn ? 'অবস্থা' : 'Status'}</th>
                    <th className="px-3.5 py-2.5 text-right">{isBn ? 'অ্যাকশন' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hyper-border-subtle)]">
                  {pagination.pageItems.map((expense) => (
                    <tr key={expense.id} className="hover:bg-[var(--hyper-bg-card-hover)]">
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-[11px] font-semibold text-[var(--hyper-text-secondary)]">
                        {expense.expenseDate}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <p
                          className={`font-bold ${
                            expense.status === 'reversed'
                              ? 'text-[var(--hyper-text-tertiary)] line-through'
                              : 'text-[var(--hyper-text-primary)]'
                          }`}
                        >
                          {expense.title}
                        </p>
                        {expense.description && (
                          <p className="max-w-[280px] truncate text-[11px] text-[var(--hyper-text-secondary)]">
                            {expense.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <StatusBadge tone={expense.group === 'building' ? 'info' : 'success'}>
                          {groupLabel(expense.group)}
                        </StatusBadge>
                        <p className="mt-0.5 text-[11px] text-[var(--hyper-text-secondary)]">
                          {categoryLabel(expense.category)}
                        </p>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11px] text-[var(--hyper-text-secondary)]">
                        {expense.propertyName || '—'}
                        {expense.paidTo ? ` • ${expense.paidTo}` : ''}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold tabular-nums text-[var(--hyper-text-primary)]">
                        {formatLocalizedCurrency(expense.amount, currentLanguage, useBanglaNumerals)}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <StatusBadge tone={expense.status === 'reversed' ? 'danger' : 'success'}>
                          {expense.status === 'reversed'
                            ? isBn
                              ? 'বাতিল'
                              : 'Reversed'
                            : isBn
                              ? 'সক্রিয়'
                              : 'Active'}
                        </StatusBadge>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailsExpense(expense)}
                            className="rounded-lg border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] cursor-pointer"
                          >
                            {t('hisab.module.auditDetails')}
                          </button>
                          {expense.status === 'active' && canRecordExpenses && (
                            <button
                              type="button"
                              onClick={() => openEditModal(expense)}
                              className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[var(--hyper-green)] transition-colors hover:bg-[var(--hyper-green-bg)] cursor-pointer"
                            >
                              {t('hisab.module.edit')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[var(--hyper-border-subtle)] px-3.5 py-2.5">
              <HisabPagination
                page={pagination.page}
                pageCount={pagination.pageCount}
                total={pagination.total}
                rangeStart={pagination.rangeStart}
                rangeEnd={pagination.rangeEnd}
                canPrev={pagination.canPrev}
                canNext={pagination.canNext}
                onPrev={pagination.goPrev}
                onNext={pagination.goNext}
                labels={paginationLabels}
              />
            </div>
          </>
        )}
      </HyperCard>

      {/* Property-wise building expense summary */}
      <HisabSection
        title={t('hisab.module.propertyExpenseSummary')}
        subtitle={`${formatCount(propertyExpenseSummaries.length)} ${isBn ? 'প্রপার্টি' : 'properties'}`}
        icon={Building2}
      >
        {propertyExpenseSummaries.length === 0 ? (
          <p className="py-3 text-center text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'কোনো প্রপার্টি খরচ পাওয়া যায়নি।' : 'No property expenses found.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-xs">
              <thead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--hyper-text-secondary)]">
                <tr>
                  <th className="px-2 py-2">{t('hisab.propertyLabel')}</th>
                  <th className="px-2 py-2 text-center">{t('hisab.module.entries')}</th>
                  <th className="px-2 py-2 text-right">{isBn ? 'মোট খরচ' : 'Total'}</th>
                  <th className="px-2 py-2 text-center">{isBn ? 'অনুপাত' : 'Share'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hyper-border-subtle)]">
                {propertyExpenseSummaries.map((property) => {
                  const share =
                    operatingSummary.buildingExpenses > 0
                      ? Math.round((property.totalAmount / operatingSummary.buildingExpenses) * 100)
                      : 0;
                  return (
                    <tr key={property.propertyId}>
                      <td className="px-2 py-2 font-bold text-[var(--hyper-text-primary)]">
                        {property.propertyName}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums text-[var(--hyper-text-secondary)]">
                        {formatCount(property.count)}
                      </td>
                      <td className="px-2 py-2 text-right font-bold tabular-nums text-[var(--hyper-text-primary)]">
                        {formatLocalizedCurrency(
                          property.totalAmount,
                          currentLanguage,
                          useBanglaNumerals
                        )}
                      </td>
                      <td className="px-2 py-2 text-center font-semibold tabular-nums text-[var(--hyper-text-secondary)]">
                        {formatCount(share)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </HisabSection>

      {/* Add / edit expense modal */}
      <ExpenseModal
        key={`${editingExpense?.id || 'new'}-${month}`}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingExpense(null);
        }}
        properties={properties}
        initialExpense={editingExpense}
        defaultMonth={month}
        onSuccess={() => {
          setModalOpen(false);
          setEditingExpense(null);
          setToastMessage(
            isBn ? 'খরচ সফলভাবে সংরক্ষণ হয়েছে।' : 'Expense saved successfully.'
          );
          window.setTimeout(() => setToastMessage(null), 5000);
        }}
      />

      <ExpenseDetailsModal
        isOpen={detailsExpense !== null}
        onClose={() => setDetailsExpense(null)}
        expense={detailsExpense}
        onEdit={(expense) => {
          setDetailsExpense(null);
          openEditModal(expense);
        }}
        onReversed={() => {
          setToastMessage(isBn ? 'খরচ বাতিল (reversed) করা হয়েছে।' : 'Expense reversed.');
          window.setTimeout(() => setToastMessage(null), 5000);
        }}
      />
    </div>
  );
}
