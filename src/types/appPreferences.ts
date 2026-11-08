import type { BuildingExpenseCategory } from './finance';

export interface AppPreferences {
  showTotalCollected: boolean;
  showTotalDue: boolean;
  showTotalExpenses: boolean;
  showCashInHand: boolean;
  showQuickCollectRent: boolean;
  showQuickNewExpense: boolean;
  showQuickAddTenant: boolean;
  showQuickAllAccounts: boolean;
  useBanglaNumerals: boolean;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  showTotalCollected: true,
  showTotalDue: true,
  showTotalExpenses: true,
  showCashInHand: true,
  showQuickCollectRent: true,
  showQuickNewExpense: true,
  showQuickAddTenant: true,
  showQuickAllAccounts: true,
  useBanglaNumerals: false,
};

export const EXPENSE_CATEGORIES: { id: BuildingExpenseCategory; label: string }[] = [
  { id: 'electricity', label: 'বিদ্যুৎ বিল (Electricity)' },
  { id: 'water', label: 'পানি বিল (Water)' },
  { id: 'gas', label: 'গ্যাস বিল (Gas)' },
  { id: 'maintenance_repair', label: 'মেরামত ও রক্ষণাবেক্ষণ (Repair)' },
  { id: 'caretaker_salary', label: 'কেয়ারটেকার ও দারোয়ান বেতন' },
  { id: 'security', label: 'নিরাপত্তা ও গার্ড' },
  { id: 'cleaning', label: 'পরিচ্ছন্নতা (Cleaning)' },
  { id: 'other_building', label: 'অন্যান্য ভবন খরচ' },
];
