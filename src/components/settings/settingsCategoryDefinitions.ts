import {
  UserRound,
  Languages,
  LayoutDashboard,
  Palette,
  Calculator,
  Tag,
  Compass,
  Bell,
  Users,
  ShieldCheck,
  HardDrive,
  Info,
  Boxes,
} from 'lucide-react';

export type SettingsCategoryId =
  | 'language'
  | 'appearance'
  | 'profile'
  | 'dashboard'
  | 'navigation'
  | 'modules'
  | 'billing'
  | 'expenses'
  | 'notifications'
  | 'users'
  | 'security'
  | 'backup'
  | 'about';

export interface SettingsCategoryDef {
  id: SettingsCategoryId;
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  subtitleEn: string;
  icon: typeof UserRound;
  iconBg: string;
  iconColor: string;
  badge?: string;
  adminOnly?: boolean;
}

export interface SettingsGroupDef {
  id: string;
  titleBn: string;
  titleEn: string;
  categoryIds: SettingsCategoryId[];
}

export const SETTINGS_CATEGORIES: SettingsCategoryDef[] = [
  // 1. Personalization
  {
    id: 'language',
    titleBn: 'Language & Region',
    titleEn: 'Language & Region',
    subtitleBn: 'বাংলা / English, তারিখ, সময়, মুদ্রা',
    subtitleEn: 'Language, date format, number display',
    icon: Languages,
    iconBg: 'bg-[var(--hyper-blue-bg)]',
    iconColor: 'text-[#1685E8]',
    badge: 'নতুন',
  },
  {
    id: 'appearance',
    titleBn: 'Appearance & Theme',
    titleEn: 'Appearance & Theme',
    subtitleBn: 'Light, Dark, System, Accent Color',
    subtitleEn: 'Theme modes, card styling & colors',
    icon: Palette,
    iconBg: 'bg-[var(--hyper-orange-bg)]',
    iconColor: 'text-[#F28A24]',
  },
  {
    id: 'profile',
    titleBn: 'প্রোফাইল ও অ্যাকাউন্ট',
    titleEn: 'Profile & Account',
    subtitleBn: 'Admin profile, নাম, ছবি, পাসওয়ার্ড',
    subtitleEn: 'User info, workspace identity & credentials',
    icon: UserRound,
    iconBg: 'bg-[var(--hyper-green-bg)]',
    iconColor: 'text-[#22B84A]',
  },

  // 2. App Customization
  {
    id: 'dashboard',
    titleBn: 'Dashboard Customization',
    titleEn: 'Dashboard Customization',
    subtitleBn: 'Financial cards, Quick Actions, card order',
    subtitleEn: 'Cards visibility, layout & arrangement',
    icon: LayoutDashboard,
    iconBg: 'bg-[var(--hyper-purple-bg)]',
    iconColor: 'text-[#7655E8]',
    adminOnly: true,
  },
  {
    id: 'navigation',
    titleBn: 'Navigation Settings',
    titleEn: 'Navigation Manager',
    subtitleBn: 'Bottom navigation, menu visibility & order',
    subtitleEn: 'Arrange navigation pills & action shortcuts',
    icon: Compass,
    iconBg: 'bg-[var(--hyper-blue-bg)]',
    iconColor: 'text-[#1685E8]',
    adminOnly: true,
  },
  {
    id: 'modules',
    titleBn: 'Module Manager',
    titleEn: 'Module Manager',
    subtitleBn: 'কোর, ফিন্যান্স ও অ্যাডমিন মডিউল বিন্যাস',
    subtitleEn: 'Enable, order and configure app modules',
    icon: Boxes,
    iconBg: 'bg-[var(--hyper-purple-bg)]',
    iconColor: 'text-[#7655E8]',
    adminOnly: true,
  },

  // 3. Property Management
  {
    id: 'billing',
    titleBn: 'Billing & Rent Settings',
    titleEn: 'Billing & Rent Settings',
    subtitleBn: 'ভাড়া, বিলিং ও পেমেন্ট পছন্দ',
    subtitleEn: 'Billing cycle, due date threshold & table density',
    icon: Calculator,
    iconBg: 'bg-[var(--hyper-green-bg)]',
    iconColor: 'text-[#22B84A]',
    adminOnly: true,
  },
  {
    id: 'expenses',
    titleBn: 'Expense Categories',
    titleEn: 'Expense Categories',
    subtitleBn: 'ক্যাটাগরি, নাম, Icon, সক্রিয়তা',
    subtitleEn: 'Category management & custom expense tags',
    icon: Tag,
    iconBg: 'bg-[var(--hyper-red-bg)]',
    iconColor: 'text-[#E94B4B]',
    adminOnly: true,
  },

  // 4. Preferences & Control
  {
    id: 'notifications',
    titleBn: 'Notifications',
    titleEn: 'Notifications & Alerts',
    subtitleBn: 'Reminder, notification preferences',
    subtitleEn: 'Due reminders, alerts & banners',
    icon: Bell,
    iconBg: 'bg-[var(--hyper-orange-bg)]',
    iconColor: 'text-[#F28A24]',
  },
  {
    id: 'users',
    titleBn: 'User & Permission Settings',
    titleEn: 'Users & Permissions',
    subtitleBn: 'Member roles, permission management',
    subtitleEn: 'RBAC controls, roles & member directory',
    icon: Users,
    iconBg: 'bg-[var(--hyper-purple-bg)]',
    iconColor: 'text-[#7655E8]',
    adminOnly: true,
  },
  {
    id: 'security',
    titleBn: 'Security & Privacy',
    titleEn: 'Security & Privacy',
    subtitleBn: 'Session, login security, activity log',
    subtitleEn: 'Auth persistence, isolation & security gates',
    icon: ShieldCheck,
    iconBg: 'bg-[var(--hyper-green-bg)]',
    iconColor: 'text-[#22B84A]',
  },
  {
    id: 'backup',
    titleBn: 'Data & Backup',
    titleEn: 'Data & Backup',
    subtitleBn: 'Export, backup, restore preferences',
    subtitleEn: 'CSV ledgers export & preference backup',
    icon: HardDrive,
    iconBg: 'bg-[var(--hyper-blue-bg)]',
    iconColor: 'text-[#1685E8]',
    adminOnly: true,
  },
  {
    id: 'about',
    titleBn: 'About & Support',
    titleEn: 'About & Support',
    subtitleBn: 'App version, help, terms, developer info',
    subtitleEn: 'Official identity, version info & release logs',
    icon: Info,
    iconBg: 'bg-black/10 dark:bg-white/10',
    iconColor: 'text-[var(--hyper-text-secondary)]',
  },
];

export const SETTINGS_GROUPS: SettingsGroupDef[] = [
  {
    id: 'personalization',
    titleBn: 'ব্যক্তিগতকরণ',
    titleEn: 'PERSONALIZATION',
    categoryIds: ['language', 'appearance', 'profile'],
  },
  {
    id: 'customization',
    titleBn: 'অ্যাপ কাস্টমাইজেশন',
    titleEn: 'APP CUSTOMIZATION',
    categoryIds: ['dashboard', 'navigation', 'modules'],
  },
  {
    id: 'property',
    titleBn: 'প্রপার্টি ব্যবস্থাপনা',
    titleEn: 'PROPERTY MANAGEMENT',
    categoryIds: ['billing', 'expenses'],
  },
  {
    id: 'preferences',
    titleBn: 'পছন্দ ও নিয়ন্ত্রণ',
    titleEn: 'PREFERENCES & CONTROL',
    categoryIds: ['notifications', 'users', 'security', 'backup', 'about'],
  },
];
