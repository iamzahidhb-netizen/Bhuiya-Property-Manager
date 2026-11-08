import React, { useState } from 'react';
import {
  CheckCircle2,
  ArrowLeft,
  Search,
  ChevronRight,
  Shield,
} from 'lucide-react';
import {
  SettingsHome,
} from './SettingsHome';
import {
  type SettingsCategoryId,
  type SettingsCategoryDef,
  SETTINGS_CATEGORIES,
  SETTINGS_GROUPS,
} from './settingsCategoryDefinitions';
import { ProfileAccountSettings } from './ProfileAccountSettings';
import { LanguageRegionSettings } from './LanguageRegionSettings';
import { DashboardCustomizationSettings } from './DashboardCustomizationSettings';
import { AppearanceThemeSettings } from './AppearanceThemeSettings';
import { BillingRentSettings } from './BillingRentSettings';
import { ExpenseCategorySettings } from './ExpenseCategorySettings';
import { NavigationManagerSettings } from './NavigationManagerSettings';
import { ModuleManagerSettings } from './ModuleManagerSettings';
import { NotificationSettings } from './NotificationSettings';
import { UserPermissionSettings } from './UserPermissionSettings';
import { SecurityPrivacySettings } from './SecurityPrivacySettings';
import { DataBackupSettings } from './DataBackupSettings';
import { AboutSupportSettings } from './AboutSupportSettings';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';

export interface SettingsCenterProps {
  initialCategory?: SettingsCategoryId | null;
  onBack?: () => void;
  onOpenMemberManagement?: () => void;
  className?: string;
}

export const SettingsCenter: React.FC<SettingsCenterProps> = ({
  initialCategory = null,
  onBack,
  onOpenMemberManagement,
  className = '',
}) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId | null>(initialCategory);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const { isSavedNoticeVisible } = useSettings();
  const { currentLanguage } = useLanguage();
  const { isMasterAdmin } = useWorkspace();

  React.useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __setSettingsCategory?: (id: SettingsCategoryId | null) => void }).__setSettingsCategory = (id) => {
        setActiveCategory(id);
      };
    }
  }, []);

  const isBn = currentLanguage === 'bn';
  const categoryMap = new Map(SETTINGS_CATEGORIES.map((cat) => [cat.id, cat]));

  // On desktop, default to 'language' if activeCategory is null so content panel is never blank
  const desktopActiveCategory: SettingsCategoryId = activeCategory || 'language';

  const filteredSidebarCategories = SETTINGS_CATEGORIES.filter((cat) => {
    if (!sidebarSearch) return true;
    const term = sidebarSearch.toLowerCase();
    return (
      cat.titleBn.toLowerCase().includes(term) ||
      cat.titleEn.toLowerCase().includes(term) ||
      cat.subtitleBn.toLowerCase().includes(term) ||
      cat.subtitleEn.toLowerCase().includes(term)
    );
  });

  const renderActiveCategoryContent = (catId: SettingsCategoryId) => {
    const handleSubBack = () => setActiveCategory(null);

    switch (catId) {
      case 'language':
        return <LanguageRegionSettings onBack={handleSubBack} />;
      case 'appearance':
        return <AppearanceThemeSettings onBack={handleSubBack} />;
      case 'profile':
        return <ProfileAccountSettings onBack={handleSubBack} />;
      case 'dashboard':
        return <DashboardCustomizationSettings onBack={handleSubBack} />;
      case 'navigation':
        return <NavigationManagerSettings onBack={handleSubBack} />;
      case 'modules':
        return <ModuleManagerSettings onBack={handleSubBack} />;
      case 'billing':
        return <BillingRentSettings onBack={handleSubBack} />;
      case 'expenses':
        return <ExpenseCategorySettings onBack={handleSubBack} />;
      case 'notifications':
        return <NotificationSettings onBack={handleSubBack} />;
      case 'users':
        return (
          <UserPermissionSettings
            onBack={handleSubBack}
            onOpenMemberManagement={onOpenMemberManagement}
          />
        );
      case 'security':
        return <SecurityPrivacySettings onBack={handleSubBack} />;
      case 'backup':
        return <DataBackupSettings onBack={handleSubBack} />;
      case 'about':
        return <AboutSupportSettings onBack={handleSubBack} />;
      default:
        return <LanguageRegionSettings onBack={handleSubBack} />;
    }
  };

  const renderSidebarItem = (cat: SettingsCategoryDef) => {
    const Icon = cat.icon;
    const title = isBn ? cat.titleBn : cat.titleEn;
    const subtitle = isBn ? cat.subtitleBn : cat.subtitleEn;
    const isSelected = desktopActiveCategory === cat.id;

    return (
      <button
        key={cat.id}
        type="button"
        data-sidebar-category={cat.id}
        onClick={() => setActiveCategory(cat.id)}
        className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all duration-150 text-left cursor-pointer group ${
          isSelected
            ? 'bg-[#22B84A]/10 text-[#22B84A] dark:text-[#2dd35b] font-bold shadow-xs border-l-4 border-[#22B84A]'
            : 'text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-8 h-8 rounded-[11px] ${cat.iconBg} flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105`}
            aria-hidden="true"
          >
            <Icon className={`w-4 h-4 ${cat.iconColor}`} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold truncate leading-tight">
                {title}
              </span>
              {cat.badge && (
                <span className="text-[9px] font-bold px-1 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {cat.badge}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[var(--hyper-text-tertiary)] truncate mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        <ChevronRight
          className={`w-3.5 h-3.5 shrink-0 ml-1 transition-transform ${
            isSelected
              ? 'text-[#22B84A] translate-x-0.5'
              : 'text-[var(--hyper-text-tertiary)] group-hover:text-[var(--hyper-text-secondary)]'
          }`}
          strokeWidth={2.2}
        />
      </button>
    );
  };

  return (
    <div
      className={`min-h-screen bg-[var(--hyper-bg-base)] text-[var(--hyper-text-primary)] flex flex-col ${className}`}
      data-testid="hyperos-settings-center"
    >
      {/* Toast Notice */}
      {isSavedNoticeVisible && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#22B84A] text-white text-xs font-bold shadow-lg shadow-[#22B84A]/30 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{isBn ? 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে' : 'Settings saved successfully!'}</span>
        </div>
      )}

      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 bg-[var(--hyper-surface)]/90 backdrop-blur-md border-b border-[var(--hyper-border-subtle)] px-4 sm:px-6 py-3 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Back Arrow + App Title */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label={isBn ? 'প্রোফাইলে ফিরে যান' : 'Back to Profile'}
                className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[var(--hyper-text-primary)] transition-colors cursor-pointer select-none"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-[var(--hyper-text-primary)] leading-tight">
                  {isBn ? 'সেটিংস সেন্টার' : 'Settings Center'}
                </h1>
                {isMasterAdmin && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    <Shield className="w-3 h-3" />
                    <span>{isBn ? 'মাস্টার এডমিন' : 'Master Admin'}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--hyper-text-secondary)] hidden sm:block">
                {isBn
                  ? 'অ্যানোয়ার ভূঁইয়া প্রপার্টি • পছন্দ ও নিয়ন্ত্রণ কেন্দ্র'
                  : 'Anwar Bhuiyan Property • Preferences & App Control'}
              </p>
            </div>
          </div>

          {/* Right: Quick Back Link */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[var(--hyper-text-primary)] transition-colors cursor-pointer select-none"
            >
              {isBn ? 'ড্যাশবোর্ডে ফিরুন' : 'Back to Dashboard'}
            </button>
          )}
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 1. DESKTOP LAYOUT (≥ 768px): 2-Column Professional Architecture        */}
      {/* ===================================================================== */}
      <div className="hidden md:flex flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 gap-6">
        {/* Left Sidebar: Navigation & Search */}
        <aside className="w-72 lg:w-80 shrink-0 space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--hyper-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder={isBn ? 'সেটিংস খুঁজুন...' : 'Search settings...'}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl hyper-input-field font-medium placeholder:text-[var(--hyper-text-tertiary)]"
            />
          </div>

          {/* Sidebar Category Groups */}
          <div className="space-y-4 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
            {sidebarSearch.trim() !== '' ? (
              <div className="space-y-1">
                {filteredSidebarCategories.length > 0 ? (
                  filteredSidebarCategories.map(renderSidebarItem)
                ) : (
                  <div className="p-4 text-center text-xs text-[var(--hyper-text-secondary)]">
                    {isBn ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No results found'}
                  </div>
                )}
              </div>
            ) : (
              SETTINGS_GROUPS.map((group) => {
                const groupTitle = isBn ? group.titleBn : group.titleEn;
                const categoriesInGroup = group.categoryIds
                  .map((id) => categoryMap.get(id))
                  .filter((c): c is SettingsCategoryDef => Boolean(c));

                return (
                  <div key={group.id} className="space-y-1.5">
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--hyper-text-tertiary)]">
                      {groupTitle}
                    </div>
                    <div className="space-y-0.5">
                      {categoriesInGroup.map(renderSidebarItem)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Content Panel: Active Settings View */}
        <main className="flex-1 min-w-0 bg-[var(--hyper-surface)] rounded-3xl p-6 border border-[var(--hyper-border-subtle)] shadow-xs">
          {renderActiveCategoryContent(desktopActiveCategory)}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* 2. MOBILE LAYOUT (< 768px, target 390 × 844): Full-Page Drill-Down   */}
      {/* ===================================================================== */}
      <div className="md:hidden flex-1 px-3 sm:px-4 py-4">
        {/* Mobile View 1: Settings Home (Grouped Categories) */}
        {activeCategory === null && (
          <SettingsHome
            onSelectCategory={(id) => setActiveCategory(id)}
            onBack={onBack}
            isMasterAdmin={Boolean(isMasterAdmin)}
          />
        )}

        {/* Mobile View 2: Dedicated Category Sub-Page with Back Navigation */}
        {activeCategory !== null && (
          <div className="space-y-4">
            {renderActiveCategoryContent(activeCategory)}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsCenter;
