import {
  collection,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createCallable } from '../lib/apiClient';
import { parseTimestampMillis } from '../utils/dhakaDate';
import type {
  Expense,
  ExpenseFormData,
  EditExpenseFormData,
  ReverseExpenseInput,
  ExpenseGroup,
  ExpenseCategory,
  BuildingExpenseCategory,
  FamilyExpenseCategory,
  RentPayment,
} from '../types/finance';
import { MONTHLY_BUILDING_EXPENSE_BUDGET } from '../types/finance';

const EXPENSES_COLL = 'expenses';

// Category Labels (Bengali & English)
export const BUILDING_CATEGORY_LABELS: Record<BuildingExpenseCategory, { bn: string; en: string }> = {
  electricity: { bn: 'বিদ্যুৎ বিল', en: 'Electricity' },
  gas: { bn: 'গ্যাস বিল', en: 'Gas' },
  water: { bn: 'পানি বিল', en: 'Water' },
  caretaker_salary: { bn: 'কেয়ারটেকার বেতন', en: 'Caretaker Salary' },
  maintenance_repair: { bn: 'মেরামত ও রক্ষণাবেক্ষণ', en: 'Maintenance & Repair' },
  cleaning: { bn: 'পরিচ্ছন্নতা ও বর্জ্য', en: 'Cleaning & Waste' },
  security: { bn: 'নিরাপত্তা গার্ড', en: 'Security Guard' },
  other_building: { bn: 'অন্যান্য ভবন খরচ', en: 'Other Building' },
};

export const FAMILY_CATEGORY_LABELS: Record<FamilyExpenseCategory, { bn: string; en: string }> = {
  bazaar: { bn: 'বাজার-সদাই', en: 'Bazaar & Grocery' },
  invitation_event: { bn: 'দাওয়াত ও অনুষ্ঠান', en: 'Invitation & Social Event' },
  gift: { bn: 'উপহার ও হাদিয়া', en: 'Gifts' },
  medical: { bn: 'চিকিৎসা ও ওষুধ', en: 'Medical & Healthcare' },
  transport: { bn: 'যাতায়াত ও ভাড়া', en: 'Transport & Travel' },
  emergency: { bn: 'জরুরি পারিবারিক খরচ', en: 'Emergency Expense' },
  other_family: { bn: 'অন্যান্য পারিবারিক খরচ', en: 'Other Family' },
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, { bn: string; en: string }> = {
  ...BUILDING_CATEGORY_LABELS,
  ...FAMILY_CATEGORY_LABELS,
};

export interface ExpenseFilters {
  group?: ExpenseGroup | 'all';
  propertyId?: string | null;
  billingMonth?: string | null; // YYYY-MM
  category?: ExpenseCategory | 'all';
  status?: 'active' | 'reversed' | 'all';
}

/**
 * Real-time subscription to expenses.
 */
export function subscribeExpenses(
  _ownerUid: string,
  filters: ExpenseFilters,
  onUpdate: (expenses: Expense[]) => void,
  onError?: (error: Error) => void,
  workspaceId?: string | null
): Unsubscribe {
  const effectiveWsId = workspaceId || 'workspace_bhuiya_family';
  const constraints = [where('workspaceId', '==', effectiveWsId)];

  if (filters.group && filters.group !== 'all') {
    constraints.push(where('group', '==', filters.group));
  }
  if (filters.propertyId) {
    constraints.push(where('propertyId', '==', filters.propertyId));
  }
  if (filters.billingMonth) {
    constraints.push(where('billingMonth', '==', filters.billingMonth));
  }
  if (filters.category && filters.category !== 'all') {
    constraints.push(where('category', '==', filters.category));
  }
  if (filters.status && filters.status !== 'all') {
    constraints.push(where('status', '==', filters.status));
  }

  const q = query(collection(db, EXPENSES_COLL), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const expenses: Expense[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Expense, 'id'>),
      }));

      // Sort newest expense date first, then by createdAt
      expenses.sort((a, b) => {
        if (a.expenseDate !== b.expenseDate) {
          return b.expenseDate.localeCompare(a.expenseDate);
        }
        const timeA = parseTimestampMillis(a.createdAt);
        const timeB = parseTimestampMillis(b.createdAt);
        return timeB - timeA;
      });

      onUpdate(expenses);
    },
    (err) => {
      console.error('[ExpenseService] subscribeExpenses error:', err);
      if (onError) onError(err);
    }
  );
}

// =============================================================================
// CALLABLE CLOUD FUNCTIONS
// =============================================================================

export interface CreateExpenseResult {
  success: boolean;
  expenseId: string;
  title: string;
  amount: number;
  group: ExpenseGroup;
  category: ExpenseCategory;
  billingMonth: string;
}

export async function createExpense(
  input: ExpenseFormData
): Promise<CreateExpenseResult> {
  const createFn = createCallable<ExpenseFormData, CreateExpenseResult>(
    'createExpenseCallable'
  );
  const res = await createFn(input);
  return res.data;
}

export interface UpdateExpenseResult {
  success: boolean;
  expenseId: string;
  newAmount: number;
  auditEntriesCount: number;
}

export async function updateExpense(
  input: EditExpenseFormData
): Promise<UpdateExpenseResult> {
  const updateFn = createCallable<EditExpenseFormData, UpdateExpenseResult>(
    'updateExpenseCallable'
  );
  const res = await updateFn(input);
  return res.data;
}

export interface ReverseExpenseResult {
  success: boolean;
  expenseId: string;
  status: 'reversed';
}

export async function reverseExpense(
  input: ReverseExpenseInput
): Promise<ReverseExpenseResult> {
  const reverseFn = createCallable<ReverseExpenseInput, ReverseExpenseResult>(
    'reverseExpenseCallable'
  );
  const res = await reverseFn(input);
  return res.data;
}

// =============================================================================
// FINANCIAL SUMMARY CALCULATION
// =============================================================================

export interface FinancialOperatingSummary {
  billingMonth: string;
  actualRentCollected: number;
  buildingExpenses: number;
  familyExpenses: number;
  totalActualExpenses: number;
  netOperatingSurplus: number;
  buildingBudgetTarget: number;
  buildingBudgetVariance: number; // positive = over budget, negative = under budget
  budgetUtilizationPercent: number;
}

/**
 * Calculates net operating balance strictly according to financial rules:
 * Net Operating Balance = Actual Collections - Actual Building Expenses - Actual Family Expenses
 */
export function calculateOperatingSummary(
  month: string,
  rentPayments: RentPayment[],
  expenses: Expense[]
): FinancialOperatingSummary {
  // Only actual received payments in rent_payments (excluding reversals)
  const actualRentCollected = rentPayments
    .filter((p) => p.billingMonth === month && p.entryType === 'payment')
    .reduce((sum, p) => sum + p.amount, 0);

  // Only active (non-reversed) expenses in this month
  const activeMonthExpenses = expenses.filter(
    (e) => e.billingMonth === month && e.status === 'active'
  );

  const buildingExpenses = activeMonthExpenses
    .filter((e) => e.group === 'building')
    .reduce((sum, e) => sum + e.amount, 0);

  const familyExpenses = activeMonthExpenses
    .filter((e) => e.group === 'family')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalActualExpenses = buildingExpenses + familyExpenses;
  const netOperatingSurplus = actualRentCollected - totalActualExpenses;

  const buildingBudgetTarget = MONTHLY_BUILDING_EXPENSE_BUDGET;
  const buildingBudgetVariance = buildingExpenses - buildingBudgetTarget;
  const budgetUtilizationPercent = Math.round((buildingExpenses / buildingBudgetTarget) * 100);

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
