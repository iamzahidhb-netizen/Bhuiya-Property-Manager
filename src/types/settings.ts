/**
 * Centralized Settings Data Model & Types
 * Anwar Bhuiyan Property — Xiaomi HyperOS Settings Architecture
 */

export type AppTheme = 'light' | 'dark' | 'system';
export type AppLanguage = 'bn' | 'en';
export type AccentColor = 'green' | 'blue' | 'orange' | 'purple';

export interface DashboardSectionConfig {
  id: 'banner' | 'financialSummary' | 'quickActions' | 'propertySummary' | 'recentActivity';
  labelBn: string;
  labelEn: string;
  visible: boolean;
  order: number;
}

export interface FinancialCardConfig {
  id: 'totalCollected' | 'totalDue' | 'totalExpenses' | 'cashInHand';
  labelBn: string;
  labelEn: string;
  visible: boolean;
  order: number;
  color: 'green' | 'red' | 'orange' | 'blue';
}

export interface QuickActionConfig {
  id: 'rentDeposit' | 'newExpense' | 'addTenant' | 'allAccounts';
  labelBn: string;
  labelEn: string;
  visible: boolean;
  order: number;
  color: 'green' | 'orange' | 'blue' | 'purple';
}

export interface NavItemConfig {
  id: 'home' | 'accounts' | 'newExpense' | 'rentDeposit' | 'profile';
  labelBn: string;
  labelEn: string;
  visible: boolean;
  order: number;
  isActionShortcut?: boolean;
}

export interface ModuleConfig {
  id: string;
  labelBn: string;
  labelEn: string;
  visible: boolean;
  order: number;
  iconName: string;
  category: 'core' | 'finance' | 'admin';
}

export interface ExpenseCategoryConfig {
  id: string;
  labelBn: string;
  labelEn: string;
  active: boolean;
  isCustom?: boolean;
  order: number;
}

export interface AppSettings {
  languageRegion: {
    language: AppLanguage;
    useBanglaNumerals: boolean;
    dateFormat: 'DD/MM/YYYY' | 'DD MMM YYYY' | 'YYYY-MM-DD';
    timeFormat: '12h' | '24h';
    currency: 'BDT';
  };
  appearance: {
    theme: AppTheme;
    accentColor: AccentColor;
    cardStyle: 'glass' | 'solid';
    layoutDensity: 'comfortable' | 'compact';
  };
  dashboard: {
    sections: DashboardSectionConfig[];
    financialCards: FinancialCardConfig[];
    quickActions: QuickActionConfig[];
  };
  navigation: {
    items: NavItemConfig[];
  };
  modules: {
    items: ModuleConfig[];
  };
  billing: {
    billingCycle: 'monthly_first';
    defaultView: 'summary' | 'detailed';
    dueDateDay: number;
    tableDensity: 'comfortable' | 'compact';
    showVacantUnitsInBilling: boolean;
  };
  expenseCategories: ExpenseCategoryConfig[];
  notifications: {
    rentDueReminders: boolean;
    expenseAlerts: boolean;
    offlineBanner: boolean;
    hapticFeedback: boolean;
  };
  security: {
    sessionTimeoutMinutes: number;
    requireConfirmOnActions: boolean;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  languageRegion: {
    language: 'bn',
    useBanglaNumerals: false,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    currency: 'BDT',
  },
  appearance: {
    theme: 'light',
    accentColor: 'green',
    cardStyle: 'glass',
    layoutDensity: 'comfortable',
  },
  dashboard: {
    sections: [
      { id: 'banner', labelBn: 'তারিখ ও প্রোফাইল ব্যানার', labelEn: 'Date & User Banner', visible: true, order: 1 },
      { id: 'financialSummary', labelBn: 'আর্থিক সারসংক্ষেপ (৪ কার্ড)', labelEn: 'Financial Summary (4 Cards)', visible: true, order: 2 },
      { id: 'quickActions', labelBn: 'দ্রুত কাজ (Quick Actions)', labelEn: 'Quick Actions', visible: false, order: 3 },
      { id: 'propertySummary', labelBn: 'সম্পত্তি সারসংক্ষেপ', labelEn: 'Property Overview', visible: true, order: 4 },
      { id: 'recentActivity', labelBn: 'সাম্প্রতিক লেনদেন', labelEn: 'Recent Activity Feed', visible: true, order: 5 },
    ],
    financialCards: [
      { id: 'totalCollected', labelBn: 'মোট জমা', labelEn: 'Total Collected', visible: true, order: 1, color: 'green' },
      { id: 'totalDue', labelBn: 'মোট বাকি', labelEn: 'Total Due', visible: true, order: 2, color: 'red' },
      { id: 'totalExpenses', labelBn: 'মোট খরচ', labelEn: 'Total Expenses', visible: true, order: 3, color: 'orange' },
      { id: 'cashInHand', labelBn: 'হাতে আছে', labelEn: 'Cash in Hand', visible: true, order: 4, color: 'blue' },
    ],
    quickActions: [
      { id: 'rentDeposit', labelBn: 'ভাড়া জমা', labelEn: 'Collect Rent', visible: true, order: 1, color: 'green' },
      { id: 'newExpense', labelBn: 'নতুন খরচ', labelEn: 'New Expense', visible: true, order: 2, color: 'orange' },
      { id: 'addTenant', labelBn: 'ভাড়াটিয়া যোগ', labelEn: 'Add Tenant', visible: true, order: 3, color: 'blue' },
      { id: 'allAccounts', labelBn: 'সকল হিসাব', labelEn: 'All Accounts', visible: true, order: 4, color: 'purple' },
    ],
  },
  navigation: {
    items: [
      { id: 'home', labelBn: 'হোম', labelEn: 'Home', visible: true, order: 1 },
      { id: 'accounts', labelBn: 'হিসাব', labelEn: 'Accounts', visible: true, order: 2 },
      { id: 'newExpense', labelBn: 'নতুন খরচ', labelEn: 'New Expense', visible: true, order: 3, isActionShortcut: true },
      { id: 'rentDeposit', labelBn: 'ভাড়া জমা', labelEn: 'Collect Rent', visible: true, order: 4, isActionShortcut: true },
      { id: 'profile', labelBn: 'প্রোফাইল', labelEn: 'Profile', visible: true, order: 5 },
    ],
  },
  modules: {
    items: [
      { id: 'dashboard', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard', visible: true, order: 1, iconName: 'House', category: 'core' },
      { id: 'accounts', labelBn: 'খাতা ও লেনদেন', labelEn: 'Accounts & Khata', visible: true, order: 2, iconName: 'BookOpen', category: 'core' },
      { id: 'properties', labelBn: 'প্রপার্টি ও ফ্ল্যাট', labelEn: 'Properties & Units', visible: true, order: 3, iconName: 'Building2', category: 'core' },
      { id: 'tenants', labelBn: 'ভাড়াটিয়া রেজিস্টার', labelEn: 'Tenant Directory', visible: true, order: 4, iconName: 'Users', category: 'core' },
      { id: 'rent', labelBn: 'ভাড়া আদায় ও বিল', labelEn: 'Rent Collection', visible: true, order: 5, iconName: 'Wallet', category: 'finance' },
      { id: 'expenses', labelBn: 'ভবন খরচ খাতা', labelEn: 'Building Expenses', visible: true, order: 6, iconName: 'ReceiptText', category: 'finance' },
      { id: 'distribution', labelBn: 'পারিবারিক বণ্টন', labelEn: 'Family Distribution', visible: true, order: 7, iconName: 'Scale', category: 'finance' },
      { id: 'reports', labelBn: 'রিপোর্ট ও বিশ্লেষণ', labelEn: 'Reports & Analytics', visible: true, order: 8, iconName: 'BarChart3', category: 'finance' },
      { id: 'members', labelBn: 'সদস্য ও অনুমতি', labelEn: 'Members & Roles', visible: true, order: 9, iconName: 'KeyRound', category: 'admin' },
      { id: 'settings', labelBn: 'সেটিংস সেন্টার', labelEn: 'Settings Center', visible: true, order: 10, iconName: 'Settings', category: 'admin' },
    ],
  },
  billing: {
    billingCycle: 'monthly_first',
    defaultView: 'summary',
    dueDateDay: 10,
    tableDensity: 'comfortable',
    showVacantUnitsInBilling: false,
  },
  expenseCategories: [
    { id: 'electricity', labelBn: 'বিদ্যুৎ বিল', labelEn: 'Electricity', active: true, order: 1 },
    { id: 'water', labelBn: 'পানি বিল', labelEn: 'Water', active: true, order: 2 },
    { id: 'gas', labelBn: 'গ্যাস বিল', labelEn: 'Gas', active: true, order: 3 },
    { id: 'maintenance_repair', labelBn: 'মেরামত ও রক্ষণাবেক্ষণ', labelEn: 'Repair & Maintenance', active: true, order: 4 },
    { id: 'caretaker_salary', labelBn: 'কেয়ারটেকার বেতন', labelEn: 'Caretaker Salary', active: true, order: 5 },
    { id: 'security', labelBn: 'নিরাপত্তা ও গার্ড', labelEn: 'Security Guard', active: true, order: 6 },
    { id: 'cleaning', labelBn: 'পরিচ্ছন্নতা', labelEn: 'Cleaning', active: true, order: 7 },
    { id: 'other_building', labelBn: 'অন্যান্য ভবন খরচ', labelEn: 'Other Building Expense', active: true, order: 8 },
  ],
  notifications: {
    rentDueReminders: true,
    expenseAlerts: true,
    offlineBanner: true,
    hapticFeedback: false,
  },
  security: {
    sessionTimeoutMinutes: 60,
    requireConfirmOnActions: true,
  },
};
