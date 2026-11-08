import React, { useState } from 'react';
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
  Search,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { useLanguage } from '../../contexts/LanguageContext';

export type SettingsCategoryId =
  | 'profile'
  | 'language'
  | 'dashboard'
  | 'appearance'
  | 'billing'
  | 'expenses'
  | 'navigation'
  | 'modules'
  | 'notifications'
  | 'users'
  | 'security'
  | 'backup'
  | 'about';

interface SettingsCategoryDef {
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

const SETTINGS_CATEGORIES: SettingsCategoryDef[] = [
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

interface SettingsHomeProps {
  onSelectCategory: (id: SettingsCategoryId) => void;
  isMasterAdmin: boolean;
}

export const SettingsHome: React.FC<SettingsHomeProps> = ({
  onSelectCategory,
  isMasterAdmin,
}) => {
  const { currentLanguage } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const isBn = currentLanguage === 'bn';

  const filteredCategories = SETTINGS_CATEGORIES.filter((cat) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      cat.titleBn.toLowerCase().includes(term) ||
      cat.titleEn.toLowerCase().includes(term) ||
      cat.subtitleBn.toLowerCase().includes(term) ||
      cat.subtitleEn.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header & Subtitle */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--hyper-text-primary)] tracking-tight">
          {isBn ? 'সেটিংস সেন্টার' : 'Settings Center'}
        </h2>
        <p className="text-xs text-[var(--hyper-text-secondary)] mt-0.5">
          {isBn ? 'অ্যাপ্লিকেশন কাস্টমাইজেশন ও সার্বিক নিয়ন্ত্রণ' : 'Customize your application experience'}
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--hyper-text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={isBn ? 'সেটিংস অনুসন্ধান করুন...' : 'Search settings...'}
          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-[20px] hyper-input-field font-medium placeholder:text-[var(--hyper-text-tertiary)]"
        />
      </div>

      {/* Grouped Category Cards (Image 1 Style) */}
      <HyperCard variant="default" className="p-1 sm:p-1.5 divide-y divide-[var(--hyper-border-subtle)]">
        {filteredCategories.map((cat) => {
          const Icon = cat.icon;
          const title = isBn ? cat.titleBn : cat.titleEn;
          const subtitle = isBn ? cat.subtitleBn : cat.subtitleEn;

          return (
            <div
              key={cat.id}
              role="button"
              tabIndex={0}
              data-settings-category={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectCategory(cat.id);
                }
              }}
              className="flex items-center justify-between p-3.5 sm:p-4 rounded-[20px] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] active:bg-black/[0.06] dark:active:bg-white/[0.08] transition-colors duration-150 cursor-pointer select-none group"
            >
              {/* Left: Squircle Icon Badge & Category Name/Description */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div
                  className={`w-10 h-10 rounded-[14px] ${cat.iconBg} flex items-center justify-center shrink-0 transition-transform duration-150 group-active:scale-95`}
                  aria-hidden="true"
                >
                  <Icon className={`w-5 h-5 ${cat.iconColor}`} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-[var(--hyper-text-primary)] leading-tight truncate">
                      {title}
                    </h4>
                    {cat.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        {cat.badge}
                      </span>
                    )}
                    {cat.adminOnly && !isMasterAdmin && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300">
                        {isBn ? 'এডমিন' : 'Admin'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--hyper-text-secondary)] mt-0.5 truncate">
                    {subtitle}
                  </p>
                </div>
              </div>

              {/* Right: Chevron */}
              <div className="shrink-0 ml-2 text-[var(--hyper-text-tertiary)] group-hover:text-[var(--hyper-text-secondary)] transition-colors">
                <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
              </div>
            </div>
          );
        })}
      </HyperCard>
    </div>
  );
};

export default SettingsHome;
