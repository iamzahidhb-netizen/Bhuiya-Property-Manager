import React, { useState } from 'react';
import {
  Boxes,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  House,
  BookOpen,
  Building2,
  Users,
  Wallet,
  ReceiptText,
  Scale,
  BarChart3,
  KeyRound,
  Settings,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { type ModuleConfig, DEFAULT_SETTINGS } from '../../types/settings';

export const ModuleManagerSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const [modules, setModules] = useState<ModuleConfig[]>(
    () => [...settings.modules.items].sort((a, b) => a.order - b.order)
  );

  function moveModule(index: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= modules.length) return;
    const next = [...modules];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setModules(next.map((item, idx) => ({ ...item, order: idx + 1 })));
  }

  function toggleModule(id: string) {
    // Safety check: Settings and Dashboard can never be toggled off
    if (id === 'settings' || id === 'dashboard') return;

    setModules(
      modules.map((m) => (m.id === id ? { ...m, visible: !m.visible } : m))
    );
  }

  function handleSave() {
    updateSettings({
      modules: {
        items: modules,
      },
    });
  }

  function handleReset() {
    setModules([...DEFAULT_SETTINGS.modules.items]);
  }

  const MODULE_ICONS: Record<string, React.ReactNode> = {
    dashboard: <House className="w-4 h-4 text-[#22B84A]" />,
    accounts: <BookOpen className="w-4 h-4 text-[#1685E8]" />,
    properties: <Building2 className="w-4 h-4 text-[#F28A24]" />,
    tenants: <Users className="w-4 h-4 text-[#7655E8]" />,
    rent: <Wallet className="w-4 h-4 text-[#22B84A]" />,
    expenses: <ReceiptText className="w-4 h-4 text-[#E94B4B]" />,
    distribution: <Scale className="w-4 h-4 text-[#1685E8]" />,
    reports: <BarChart3 className="w-4 h-4 text-[#7655E8]" />,
    members: <KeyRound className="w-4 h-4 text-[#F28A24]" />,
    settings: <Settings className="w-4 h-4 text-[#22B84A]" />,
  };

  const CATEGORY_NAMES: Record<string, { bn: string; en: string }> = {
    core: { bn: 'কোর মডিউল (Core Modules)', en: 'Core Modules' },
    finance: { bn: 'আর্থিক হিসাব মডিউল (Financial Modules)', en: 'Financial Modules' },
    admin: { bn: 'প্রশাসনিক মডিউল (Administrative Modules)', en: 'Administrative Modules' },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'মডিউল ম্যানেজার' : 'Module Manager'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'কোর, ফিন্যান্স এবং অ্যাডমিন মডিউল দৃশ্যমানতা ও বিন্যাস' : 'Organize Core, Finance and Admin modules'}
          </p>
        </div>
        <PillButton variant="ghost" size="sm" onClick={onBack}>
          ← {isBn ? 'ফিরে যান' : 'Back'}
        </PillButton>
      </div>

      {/* RBAC Independence Notice */}
      <div className="p-3.5 rounded-[20px] bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#22B84A] shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--hyper-text-secondary)]">
          <span className="font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'নিরাপত্তা ও আরবিএসি অক্ষুণ্ণতা: ' : 'RBAC Security Integrity: '}
          </span>
          {isBn
            ? 'মডিউল সক্রিয় বা লুকানো কেবল ভিজ্যুয়াল ইন্টারফেসকে প্রভাবিত করে। ফায়ারবেস ব্যাকএন্ড সিকিউরিটি ও সদস্য অনুমতি (RBAC) সম্পূর্ণ স্বাধীনভাবে সংরক্ষিত থাকে।'
            : 'Module customization affects visual availability only. Backend Firebase rules and role-based permissions (RBAC) remain strictly enforced.'}
        </div>
      </div>

      {/* Grouped Modules */}
      {(['core', 'finance', 'admin'] as const).map((category) => {
        const catModules = modules.filter((m) => m.category === category);
        return (
          <HyperCard key={category} variant="default" className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--hyper-border-subtle)]">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[var(--hyper-text-secondary)]" />
                <h4 className="text-xs font-bold text-[var(--hyper-text-secondary)] uppercase tracking-wider">
                  {isBn ? CATEGORY_NAMES[category].bn : CATEGORY_NAMES[category].en}
                </h4>
              </div>
            </div>

            <div className="space-y-2">
              {catModules.map((item) => {
                const globalIdx = modules.findIndex((m) => m.id === item.id);
                const isLocked = item.id === 'settings' || item.id === 'dashboard';

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-[18px] border transition-all flex items-center justify-between gap-3 ${
                      item.visible
                        ? 'bg-black/5 dark:bg-white/5 border-[var(--hyper-border-subtle)]'
                        : 'bg-black/2 dark:bg-white/2 border-transparent opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-[12px] bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                        {MODULE_ICONS[item.id] || <Boxes className="w-4 h-4 text-[#1685E8]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--hyper-text-primary)] truncate">
                            {isBn ? item.labelBn : item.labelEn}
                          </span>
                          {isLocked && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#22B84A]/10 text-[#22B84A] border border-[#22B84A]/20">
                              {isBn ? 'আবশ্যক' : 'Required'}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--hyper-text-secondary)]">
                          {isBn ? `পজিশন: ${item.order}` : `Order: ${item.order}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={globalIdx === 0}
                        onClick={() => moveModule(globalIdx, 'up')}
                        aria-label="Move Up"
                        className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={globalIdx === modules.length - 1}
                        onClick={() => moveModule(globalIdx, 'down')}
                        aria-label="Move Down"
                        className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => toggleModule(item.id)}
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
        );
      })}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <PillButton variant="secondary" size="sm" onClick={handleReset} className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isBn ? 'ডিফল্ট মডিউল' : 'Reset Defaults'}</span>
        </PillButton>
        <PillButton variant="primary" size="md" onClick={handleSave}>
          {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
        </PillButton>
      </div>
    </div>
  );
};
