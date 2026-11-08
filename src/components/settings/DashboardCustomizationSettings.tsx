import React, { useState } from 'react';
import {
  LayoutDashboard,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RefreshCw,
  Wallet,
  ReceiptText,
  BadgeAlert,
  Coins,
  Smartphone,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  type FinancialCardConfig,
  type QuickActionConfig,
  type DashboardSectionConfig,
  DEFAULT_SETTINGS,
} from '../../types/settings';

export const DashboardCustomizationSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  // Local state for interactive editing before save
  const [sections, setSections] = useState<DashboardSectionConfig[]>(
    () => [...settings.dashboard.sections].sort((a, b) => a.order - b.order)
  );
  const [financialCards, setFinancialCards] = useState<FinancialCardConfig[]>(
    () => [...settings.dashboard.financialCards].sort((a, b) => a.order - b.order)
  );
  const [quickActions, setQuickActions] = useState<QuickActionConfig[]>(
    () => [...settings.dashboard.quickActions].sort((a, b) => a.order - b.order)
  );
  const [showLivePreview, setShowLivePreview] = useState(true);

  // Financial cards reorder
  function moveCard(index: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= financialCards.length) return;
    const next = [...financialCards];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setFinancialCards(next.map((item, idx) => ({ ...item, order: idx + 1 })));
  }

  function toggleCardVisibility(id: string) {
    // Ensure at least 1 card remains visible
    const visibleCount = financialCards.filter((c) => c.visible).length;
    const card = financialCards.find((c) => c.id === id);
    if (card?.visible && visibleCount <= 1) return;

    setFinancialCards(
      financialCards.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  }

  // Quick actions reorder & toggle
  function moveQuickAction(index: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= quickActions.length) return;
    const next = [...quickActions];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setQuickActions(next.map((item, idx) => ({ ...item, order: idx + 1 })));
  }

  function toggleQuickAction(id: string) {
    setQuickActions(
      quickActions.map((qa) => (qa.id === id ? { ...qa, visible: !qa.visible } : qa))
    );
  }

  // Sections reorder & toggle
  function moveSection(index: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setSections(next.map((item, idx) => ({ ...item, order: idx + 1 })));
  }

  function toggleSection(id: string) {
    setSections(
      sections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  }

  function handleSave() {
    updateSettings({
      dashboard: {
        sections,
        financialCards,
        quickActions,
      },
    });
  }

  function handleReset() {
    setSections([...DEFAULT_SETTINGS.dashboard.sections]);
    setFinancialCards([...DEFAULT_SETTINGS.dashboard.financialCards]);
    setQuickActions([...DEFAULT_SETTINGS.dashboard.quickActions]);
  }

  const CARD_ICONS: Record<string, React.ReactNode> = {
    totalCollected: <Wallet className="w-4 h-4 text-[#22B84A]" />,
    totalDue: <BadgeAlert className="w-4 h-4 text-[#E94B4B]" />,
    totalExpenses: <ReceiptText className="w-4 h-4 text-[#F28A24]" />,
    cashInHand: <Coins className="w-4 h-4 text-[#1685E8]" />,
  };

  const CARD_COLORS: Record<string, string> = {
    totalCollected: 'bg-[#22B84A]/10 border-[#22B84A]/30',
    totalDue: 'bg-[#E94B4B]/10 border-[#E94B4B]/30',
    totalExpenses: 'bg-[#F28A24]/10 border-[#F28A24]/30',
    cashInHand: 'bg-[#1685E8]/10 border-[#1685E8]/30',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'ড্যাশবোর্ড কাস্টমাইজেশন' : 'Dashboard Customization'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'আর্থিক কার্ড, কুইক অ্যাকশন এবং সেকশন রিঅর্ডার' : 'Cards arrangement, visibility & layout'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PillButton
            variant="ghost"
            size="sm"
            onClick={() => setShowLivePreview(!showLivePreview)}
            className="hidden sm:inline-flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{showLivePreview ? (isBn ? 'প্রিভিউ বন্ধ' : 'Hide Preview') : (isBn ? 'লাইভ প্রিভিউ' : 'Live Preview')}</span>
          </PillButton>
          <PillButton variant="ghost" size="sm" onClick={onBack}>
            ← {isBn ? 'ফিরে যান' : 'Back'}
          </PillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Controls Column */}
        <div className={showLivePreview ? 'lg:col-span-7 space-y-5' : 'lg:col-span-12 space-y-5'}>
          {/* 1. Financial Summary Cards (4 Cards) */}
          <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--hyper-border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-green-bg)] flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-[#22B84A]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
                    {isBn ? 'আর্থিক সারসংক্ষেপ কার্ড (৪টি)' : 'Financial Summary Cards'}
                  </h4>
                  <p className="text-xs text-[var(--hyper-text-secondary)]">
                    {isBn ? 'কার্ড দৃশ্যমানতা এবং ক্রমানুসার নির্ধারণ করুন' : 'Toggle visibility & reorder financial cards'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {financialCards.map((card, idx) => {
                return (
                  <div
                    key={card.id}
                    className={`p-3 rounded-[18px] border transition-all flex items-center justify-between gap-3 ${
                      card.visible
                        ? 'bg-black/5 dark:bg-white/5 border-[var(--hyper-border-subtle)]'
                        : 'bg-black/2 dark:bg-white/2 border-transparent opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-[10px] bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                        {CARD_ICONS[card.id] || <Wallet className="w-3.5 h-3.5 text-[#22B84A]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--hyper-text-primary)] truncate">
                          {isBn ? card.labelBn : card.labelEn}
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
                        disabled={idx === 0}
                        onClick={() => moveCard(idx, 'up')}
                        aria-label="Move Up"
                        className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      {/* Down */}
                      <button
                        type="button"
                        disabled={idx === financialCards.length - 1}
                        onClick={() => moveCard(idx, 'down')}
                        aria-label="Move Down"
                        className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] disabled:opacity-20 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      {/* Visibility Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleCardVisibility(card.id)}
                        aria-label="Toggle Visibility"
                        className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer ${
                          card.visible
                            ? 'bg-[#22B84A]/15 text-[#22B84A]'
                            : 'bg-black/10 dark:bg-white/10 text-[var(--hyper-text-secondary)]'
                        }`}
                      >
                        {card.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </HyperCard>

          {/* 2. Quick Actions */}
          <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--hyper-border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-orange-bg)] flex items-center justify-center shrink-0">
                  <LayoutDashboard className="w-5 h-5 text-[#F28A24]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
                    {isBn ? 'কুইক অ্যাকশন বাটন' : 'Quick Actions'}
                  </h4>
                  <p className="text-xs text-[var(--hyper-text-secondary)]">
                    {isBn ? 'ড্যাশবোর্ডের দ্রুত অ্যাকশন বাটন সক্রিয় করুন' : 'Configure quick action shortcuts'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {quickActions.map((qa, idx) => (
                <div
                  key={qa.id}
                  className={`p-3 rounded-[18px] border transition-all flex items-center justify-between gap-3 ${
                    qa.visible
                      ? 'bg-black/5 dark:bg-white/5 border-[var(--hyper-border-subtle)]'
                      : 'bg-black/2 dark:bg-white/2 border-transparent opacity-50'
                  }`}
                >
                  <div className="text-xs font-bold text-[var(--hyper-text-primary)]">
                    {isBn ? qa.labelBn : qa.labelEn}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveQuickAction(idx, 'up')}
                      className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === quickActions.length - 1}
                      onClick={() => moveQuickAction(idx, 'down')}
                      className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleQuickAction(qa.id)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer ${
                        qa.visible
                          ? 'bg-[#22B84A]/15 text-[#22B84A]'
                          : 'bg-black/10 dark:bg-white/10 text-[var(--hyper-text-secondary)]'
                      }`}
                    >
                      {qa.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </HyperCard>

          {/* 3. Dashboard Major Sections */}
          <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--hyper-border-subtle)]">
              <div>
                <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
                  {isBn ? 'ড্যাশবোর্ড মূল সেকশনসমূহ' : 'Dashboard Sections Layout'}
                </h4>
                <p className="text-xs text-[var(--hyper-text-secondary)]">
                  {isBn ? 'সেকশনের ক্রম ও প্রদর্শন নিয়ন্ত্রণ করুন' : 'Organize and toggle top-level modules'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className={`p-3 rounded-[18px] border transition-all flex items-center justify-between gap-3 ${
                    sec.visible
                      ? 'bg-black/5 dark:bg-white/5 border-[var(--hyper-border-subtle)]'
                      : 'bg-black/2 dark:bg-white/2 border-transparent opacity-50'
                  }`}
                >
                  <span className="text-xs font-semibold text-[var(--hyper-text-primary)]">
                    {isBn ? sec.labelBn : sec.labelEn}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, 'up')}
                      className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sections.length - 1}
                      onClick={() => moveSection(idx, 'down')}
                      className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSection(sec.id)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer ${
                        sec.visible
                          ? 'bg-[#22B84A]/15 text-[#22B84A]'
                          : 'bg-black/10 dark:bg-white/10 text-[var(--hyper-text-secondary)]'
                      }`}
                    >
                      {sec.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </HyperCard>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <PillButton variant="secondary" size="sm" onClick={handleReset} className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isBn ? 'ডিফল্ট সাজান' : 'Reset Defaults'}</span>
            </PillButton>
            <PillButton variant="primary" size="md" onClick={handleSave}>
              {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
            </PillButton>
          </div>
        </div>

        {/* Live 390x844 Preview Column */}
        {showLivePreview && (
          <div className="lg:col-span-5 sticky top-20">
            <div className="w-full max-w-[340px] mx-auto rounded-[36px] p-3.5 bg-black/10 dark:bg-white/5 border-4 border-slate-300 dark:border-slate-800 shadow-2xl backdrop-blur-md">
              {/* Phone Notch/Header Simulator */}
              <div className="flex items-center justify-between px-3 pb-2 text-[10px] text-[var(--hyper-text-secondary)]">
                <span className="font-bold">09:41</span>
                <span className="text-[9px] uppercase tracking-wider">{isBn ? 'লাইভ প্রিভিউ' : 'Live Preview'}</span>
                <span>● 5G 100%</span>
              </div>

              {/* Simulated Screen Body */}
              <div className="bg-[var(--hyper-bg-card)] rounded-[26px] p-3 space-y-3 min-h-[480px] overflow-hidden border border-[var(--hyper-border-subtle)]">
                {/* Banner Simulation */}
                {sections.find((s) => s.id === 'banner')?.visible && (
                  <div className="p-2.5 rounded-[18px] bg-black/5 dark:bg-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-[var(--hyper-text-primary)]">স্বাগতম, Admin</div>
                      <div className="text-[8px] text-[var(--hyper-text-secondary)]">ঢাকা, বাংলাদেশ</div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#22B84A] text-white flex items-center justify-center text-[10px] font-bold">
                      AB
                    </div>
                  </div>
                )}

                {/* Financial Cards Simulation */}
                {sections.find((s) => s.id === 'financialSummary')?.visible && (
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-bold text-[var(--hyper-text-secondary)] uppercase tracking-wider">
                      {isBn ? 'আর্থিক সারসংক্ষেপ' : 'Financial Cards'}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {financialCards
                        .filter((c) => c.visible)
                        .map((card) => (
                          <div
                            key={card.id}
                            className={`p-2 rounded-[16px] border ${CARD_COLORS[card.id] || 'bg-black/5'} flex flex-col justify-between`}
                          >
                            <span className="text-[8px] font-medium text-[var(--hyper-text-secondary)] truncate">
                              {isBn ? card.labelBn : card.labelEn}
                            </span>
                            <span className="text-xs font-bold text-[var(--hyper-text-primary)] mt-1">
                              ৳ ১,৮৫,০০০
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions Simulation */}
                {sections.find((s) => s.id === 'quickActions')?.visible && (
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-bold text-[var(--hyper-text-secondary)] uppercase tracking-wider">
                      {isBn ? 'কুইক অ্যাকশন' : 'Quick Actions'}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {quickActions
                        .filter((q) => q.visible)
                        .map((q) => (
                          <div
                            key={q.id}
                            className="p-1.5 rounded-[12px] bg-black/5 dark:bg-white/5 text-[9px] font-bold text-center text-[var(--hyper-text-primary)] truncate"
                          >
                            {isBn ? q.labelBn : q.labelEn}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Property Summary Simulation */}
                {sections.find((s) => s.id === 'propertySummary')?.visible && (
                  <div className="p-2.5 rounded-[18px] bg-black/5 dark:bg-white/5 space-y-1">
                    <div className="text-[9px] font-bold text-[var(--hyper-text-primary)]">
                      {isBn ? 'সম্পত্তি ও ফ্ল্যাট' : 'Properties & Units'}
                    </div>
                    <div className="text-[8px] text-[var(--hyper-text-secondary)]">
                      ১টি ভবন • ৪টি ফ্ল্যাট (৪টি ভাড়া দেওয়া)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
