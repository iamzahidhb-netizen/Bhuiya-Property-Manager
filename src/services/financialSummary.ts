import type { Expense, RentPayment } from '../types/finance.ts';
import { MONTHLY_BUILDING_EXPENSE_BUDGET } from '../types/finance.ts';
import { parseTimestampMillis } from '../utils/dhakaDate.ts';
import { subtractMoney, sumMoney } from '../utils/money.ts';

export interface FinancialOperatingSummary {
  billingMonth: string;
  actualRentCollected: number;
  buildingExpenses: number;
  familyExpenses: number;
  totalActualExpenses: number;
  netOperatingSurplus: number;
  buildingBudgetTarget: number;
  buildingBudgetVariance: number;
  budgetUtilizationPercent: number;
}

function isBillingMonth(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

function getDhakaMonth(value: unknown): string | null {
  if (typeof value === 'string') {
    const dateOnly = /^(\d{4}-(?:0[1-9]|1[0-2]))(?:-\d{2})?$/.exec(value);
    if (dateOnly) return dateOnly[1];
  }

  const timestamp = parseTimestampMillis(value);
  if (!timestamp) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(timestamp));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;

  return year && month ? `${year}-${month}` : null;
}

export function getExpenseBillingMonth(expense: Expense): string | null {
  if (isBillingMonth(expense.billingMonth)) return expense.billingMonth;
  return getDhakaMonth(expense.expenseDate);
}

export function getPaymentBillingMonth(payment: RentPayment): string | null {
  if (isBillingMonth(payment.billingMonth)) return payment.billingMonth;
  return getDhakaMonth(payment.paymentDate || payment.createdAt);
}

export function calculateOperatingSummary(
  month: string,
  rentPayments: RentPayment[],
  expenses: Expense[]
): FinancialOperatingSummary {
  const actualRentCollected = sumMoney(
    rentPayments.filter(
      (payment) =>
        getPaymentBillingMonth(payment) === month && payment.entryType === 'payment'
    ),
    (payment) => payment.amount
  );

  const activeMonthExpenses = expenses.filter(
    (expense) =>
      getExpenseBillingMonth(expense) === month && expense.status === 'active'
  );

  const buildingExpenses = sumMoney(
    activeMonthExpenses.filter((expense) => expense.group === 'building'),
    (expense) => expense.amount
  );
  const familyExpenses = sumMoney(
    activeMonthExpenses.filter((expense) => expense.group === 'family'),
    (expense) => expense.amount
  );
  const totalActualExpenses = sumMoney(
    activeMonthExpenses,
    (expense) => expense.amount
  );
  const netOperatingSurplus = subtractMoney(
    actualRentCollected,
    totalActualExpenses
  );

  const buildingBudgetTarget = MONTHLY_BUILDING_EXPENSE_BUDGET;
  const buildingBudgetVariance = subtractMoney(
    buildingExpenses,
    buildingBudgetTarget
  );
  const budgetUtilizationPercent =
    buildingBudgetTarget > 0
      ? Math.round((buildingExpenses / buildingBudgetTarget) * 100)
      : 0;

  return {
    billingMonth: month,
    actualRentCollected,
    buildingExpenses,
    familyExpenses,
    totalActualExpenses,
    netOperatingSurplus,
    buildingBudgetTarget,
    buildingBudgetVariance,
    budgetUtilizationPercent,
  };
}
