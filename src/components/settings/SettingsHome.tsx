import React, { useState } from 'react';
import {
  Search,
  ChevronRight,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  type SettingsCategoryId,
  type SettingsCategoryDef,
  SETTINGS_CATEGORIES,
  SETTINGS_GROUPS,
} from './settingsCategoryDefinitions';

export type { SettingsCategoryId, SettingsCategoryDef };

export interface SettingsHomeProps {
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

  const categoryMap = new Map(SETTINGS_CATEGORIES.map((cat) => [cat.id, cat]));

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

  const renderCategoryRow = (cat: SettingsCategoryDef) => {
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
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Page title; SettingsCenter provides the single page-level back button. */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--hyper-text-primary)] tracking-tight">
          {isBn ? 'সেটিংস' : 'Settings'}
        </h2>
        <p className="text-xs text-[var(--hyper-text-secondary)] mt-0.5">
          {isBn ? 'অ্যাপ্লিকেশন পছন্দসমূহ ও কাস্টমাইজেশন' : 'Manage your application preferences'}
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

      {/* When Search Active: Show Filtered Results */}
      {searchTerm.trim() !== '' ? (
        <HyperCard variant="default" className="p-1 sm:p-1.5 divide-y divide-[var(--hyper-border-subtle)]">
          {filteredCategories.length > 0 ? (
            filteredCategories.map(renderCategoryRow)
          ) : (
            <div className="p-8 text-center text-xs text-[var(--hyper-text-secondary)]">
              <p>{isBn ? 'কোনো ডেটা নেই' : 'No data'}</p>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="mt-3 rounded-full border border-[var(--hyper-green)]/40 px-4 py-2 text-sm font-semibold text-[var(--hyper-green)] hover:bg-[var(--hyper-green-bg)]"
              >
                {isBn ? 'অনুসন্ধান মুছুন' : 'Clear search'}
              </button>
            </div>
          )}
        </HyperCard>
      ) : (
        /* When No Search: Grouped Category Cards (Section 5 Spec) */
        <div className="space-y-4">
          {SETTINGS_GROUPS.map((group) => {
            const groupTitle = isBn ? group.titleBn : group.titleEn;
            const groupCategories = group.categoryIds
              .map((id) => categoryMap.get(id))
              .filter((c): c is SettingsCategoryDef => Boolean(c));

            return (
              <div key={group.id} className="space-y-1.5">
                <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--hyper-text-secondary)]">
                  {groupTitle}
                </div>
                <HyperCard
                  variant="default"
                  className="p-1 sm:p-1.5 divide-y divide-[var(--hyper-border-subtle)]"
                >
                  {groupCategories.map(renderCategoryRow)}
                </HyperCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SettingsHome;
