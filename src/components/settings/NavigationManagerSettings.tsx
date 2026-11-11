import React, { useState } from 'react';
import {
  Compass,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RefreshCw,
  House,
  BookOpen,
  Files,
  ReceiptText,
  Wallet,
  UserRound,
  ShieldAlert,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { BackIconButton } from '../ui/hyperos/BackIconButton';
import { StatusBadge } from '../ui/hyperos/StatusBadge';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { type NavItemConfig, DEFAULT_SETTINGS } from '../../types/settings';

export const NavigationManagerSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const [navItems, setNavItems] = useState<NavItemConfig[]>(
    () => [...settings.navigation.items].sort((a, b) => a.order - b.order)
  );

  function moveNavItem(index: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= navItems.length) return;
    if (navItems[index].id === 'profile' || navItems[targetIdx].id === 'profile') return;
    const next = [...navItems];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setNavItems(next.map((item, idx) => ({ ...item, order: idx + 1 })));
  }

  function toggleNavItem(id: string) {
    if (id === 'profile') return;

    setNavItems(
      navItems.map((item) => (item.id === id ? { ...item, visible: !item.visible } : item))
    );
  }

  function handleSave() {
    updateSettings({
      navigation: {
        items: navItems,
      },
    });
  }

  function handleReset() {
    setNavItems([...DEFAULT_SETTINGS.navigation.items]);
  }

  const NAV_ICONS: Record<string, React.ReactNode> = {
    home: <House className="w-4 h-4 text-[#22B84A]" />,
    accounts: <BookOpen className="w-4 h-4 text-[#1685E8]" />,
    documents: <Files className="w-4 h-4 text-[#1685E8]" />,
    newExpense: <ReceiptText className="w-4 h-4 text-[#F28A24]" />,
    rentDeposit: <Wallet className="w-4 h-4 text-[#22B84A]" />,
    profile: <UserRound className="w-4 h-4 text-[#7655E8]" />,
  };

  const visibleItems = navItems.filter((i) => i.visible);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'নেভিগেশন ম্যানেজার' : 'Navigation Manager'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'নিচের নেভিগেশন পিলের ক্রম ও দৃশ্যমানতা নিয়ন্ত্রণ' : 'Manage bottom floating dock items & order'}
          </p>
        </div>
        <BackIconButton onClick={onBack} aria-label={isBn ? 'ফিরে যান' : 'Back'} />
      </div>

      {/* Safety Notice */}
      <div className="p-3.5 rounded-[20px] bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--hyper-text-secondary)]">
          <span className="font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'নিরাপত্তা নিশ্চিতকরণ: ' : 'Safety Guarantee: '}
          </span>
          {isBn
            ? 'প্রোফাইল স্থির থাকবে। প্রোফাইল ছাড়া অন্য যেকোনো নেভিগেশন আইটেম লুকানো যাবে।'
            : 'Profile stays fixed. Any other navigation item can be hidden.'}
        </div>
      </div>

      {/* Reorder and Visibility List */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-blue-bg)] flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5 text-[#1685E8]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'ডক আইটেম তালিকা' : 'Bottom Dock Items'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'তীর চিহ্নে ক্লিক করে ক্রমানুসার পরিবর্তন করুন' : 'Use arrow buttons to adjust order'}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {navItems.map((item, idx) => {
            const isProfile = item.id === 'profile';
            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-[20px] border transition-all flex items-center justify-between gap-3 ${
                  item.visible
                    ? 'bg-black/5 dark:bg-white/5 border-[var(--hyper-border-subtle)]'
                    : 'bg-black/2 dark:bg-white/2 border-transparent opacity-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-[12px] bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                    {NAV_ICONS[item.id] || <Compass className="w-4 h-4 text-[#1685E8]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--hyper-text-primary)] truncate">
                        {isBn ? item.labelBn : item.labelEn}
                      </span>
                      {isProfile && (
                        <StatusBadge tone="info" className="px-2 py-1 text-xs">
                          {isBn ? 'স্থির' : 'Fixed'}
                        </StatusBadge>
                      )}
                      {item.isActionShortcut && (
                        <StatusBadge tone="info" className="px-2 py-1">
                          {isBn ? 'শর্টকাট' : 'Shortcut'}
                        </StatusBadge>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--hyper-text-secondary)]">
                      {isBn ? `পজিশন: ${idx + 1}` : `Order: ${idx + 1}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Up */}
                  <button
                    type="button"
                    disabled={idx === 0 || isProfile || navItems[idx - 1]?.id === 'profile'}
                    onClick={() => moveNavItem(idx, 'up')}
                    aria-label="Move Up"
                    className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  {/* Down */}
                  <button
                    type="button"
                    disabled={idx === navItems.length - 1 || isProfile || navItems[idx + 1]?.id === 'profile'}
                    onClick={() => moveNavItem(idx, 'down')}
                    aria-label="Move Down"
                    className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  {/* Visibility Toggle */}
                  <button
                    type="button"
                    disabled={isProfile}
                    onClick={() => toggleNavItem(item.id)}
                    aria-label="Toggle Visibility"
                    className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                      item.visible
                        ? 'bg-[#22B84A]/15 text-[#22B84A]'
                        : 'bg-black/10 dark:bg-white/10 text-[var(--hyper-text-secondary)]'
                    }`}
                  >
                    {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </HyperCard>

      {/* Live Navigation Dock Preview */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--hyper-border-subtle)]">
          <h4 className="text-xs font-bold text-[var(--hyper-text-secondary)] uppercase tracking-wider">
            {isBn ? 'লাইভ নেভিগেশন ডক প্রিভিউ' : 'Live Navigation Dock Preview'}
          </h4>
          <span className="text-[11px] text-[var(--hyper-text-secondary)]">
            {isBn ? `${visibleItems.length}টি সক্রিয় আইটেম` : `${visibleItems.length} active items`}
          </span>
        </div>

        <div className="py-4 flex justify-center">
          <div className="w-full max-w-[460px] hyper-glass-nav rounded-full border border-[var(--hyper-border-glass)] p-1.5 shadow-md flex items-center justify-around gap-1">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col items-center justify-center py-1.5 px-2 rounded-full min-w-0"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  {NAV_ICONS[item.id] || <Compass className="w-4 h-4" />}
                </div>
                <span className="text-[10px] font-semibold text-[var(--hyper-text-primary)] truncate max-w-[70px]">
                  {isBn ? item.labelBn : item.labelEn}
                </span>
              </div>
            ))}
          </div>
        </div>
      </HyperCard>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <PillButton variant="secondary" size="sm" onClick={handleReset} className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isBn ? 'ডিফল্ট নেভিগেশন' : 'Reset Defaults'}</span>
        </PillButton>
        <PillButton variant="primary" size="md" onClick={handleSave}>
          {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
        </PillButton>
      </div>
    </div>
  );
};
