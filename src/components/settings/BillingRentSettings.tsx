import React, { useState } from 'react';
import {
  Calendar,
  Layers,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { DEFAULT_SETTINGS } from '../../types/settings';

export const BillingRentSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const [defaultView, setDefaultView] = useState<'summary' | 'detailed'>(
    settings.billing.defaultView
  );
  const [dueDateDay, setDueDateDay] = useState<number>(settings.billing.dueDateDay);
  const [tableDensity, setTableDensity] = useState<'comfortable' | 'compact'>(
    settings.billing.tableDensity
  );
  const [showVacantUnits, setShowVacantUnits] = useState<boolean>(
    settings.billing.showVacantUnitsInBilling
  );

  function handleSave() {
    updateSettings({
      billing: {
        ...settings.billing,
        defaultView,
        dueDateDay,
        tableDensity,
        showVacantUnitsInBilling: showVacantUnits,
      },
    });
  }

  function handleReset() {
    setDefaultView(DEFAULT_SETTINGS.billing.defaultView);
    setDueDateDay(DEFAULT_SETTINGS.billing.dueDateDay);
    setTableDensity(DEFAULT_SETTINGS.billing.tableDensity);
    setShowVacantUnits(DEFAULT_SETTINGS.billing.showVacantUnitsInBilling);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'বিলিং ও ভাড়া সেটিংস' : 'Billing & Rent Settings'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'ভাড়া চক্র, ডিউ তারিখের সতর্কবার্তা এবং প্রদর্শনী পছন্দ' : 'Billing cycle, due date threshold & table view'}
          </p>
        </div>
        <PillButton variant="ghost" size="sm" onClick={onBack}>
          ← {isBn ? 'ফিরে যান' : 'Back'}
        </PillButton>
      </div>

      {/* Cycle & Due Date */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-green-bg)] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[#22B84A]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'ভাড়া চক্র ও সময়সীমা' : 'Billing Cycle & Due Date'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'প্রতি মাসের বকেয়া গণনার নির্ধারিত নিয়ম' : 'Monthly rent due date rules'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Cycle */}
          <div className="p-3.5 rounded-[18px] bg-black/5 dark:bg-white/5 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
                {isBn ? 'বিলিং চক্র (Billing Cycle)' : 'Billing Cycle'}
              </span>
              <p className="text-[11px] text-[var(--hyper-text-secondary)] mt-0.5">
                {isBn ? 'প্রতি মাসের ১ তারিখ স্বয়ংক্রিয় বিল প্রস্তুত' : 'Monthly on the 1st of every month'}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#22B84A]/10 text-[#22B84A]">
              {isBn ? '১লা তারিখ (মাসিক)' : 'Monthly 1st'}
            </span>
          </div>

          {/* Due Threshold Day */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--hyper-text-primary)] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#F28A24]" />
                <span>{isBn ? 'ভাড়া বকেয়া সীমা (Due Date Threshold)' : 'Rent Due Day'}</span>
              </label>
              <span className="text-xs font-extrabold text-[#F28A24] bg-orange-500/10 px-2.5 py-0.5 rounded-full">
                {isBn ? `মাসের ${dueDateDay} তারিখ` : `${dueDateDay}th of month`}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={28}
              value={dueDateDay}
              onChange={(e) => setDueDateDay(Number(e.target.value))}
              className="w-full accent-[#22B84A] cursor-pointer"
            />
            <p className="text-[11px] text-[var(--hyper-text-secondary)]">
              {isBn
                ? `প্রতি মাসের ${dueDateDay} তারিখ পার হলে অপরিশোধিত ভাড়াকে লাল রঙে 'বকেয়া' চিহ্নিত করা হবে।`
                : `After the ${dueDateDay}th of the month, unpaid rent will be flagged as overdue.`}
            </p>
          </div>
        </div>
      </HyperCard>

      {/* Table & Display Preferences */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-blue-bg)] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-[#1685E8]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'প্রদর্শন ও টেবিল শৈলী' : 'Display & Table Style'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'ভাড়া খাতার ভিউ মোড ও খালি ফ্ল্যাট প্রদর্শন' : 'View mode and vacant unit visibility'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Default View */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--hyper-text-secondary)]">
              {isBn ? 'ডিফল্ট খাতা ভিউ' : 'Default View Mode'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDefaultView('summary')}
                className={`py-2.5 px-3 rounded-[16px] text-xs font-semibold border cursor-pointer ${
                  defaultView === 'summary'
                    ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)] font-bold'
                    : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
                }`}
              >
                {isBn ? 'সারসংক্ষেপ (Summary)' : 'Summary'}
              </button>
              <button
                type="button"
                onClick={() => setDefaultView('detailed')}
                className={`py-2.5 px-3 rounded-[16px] text-xs font-semibold border cursor-pointer ${
                  defaultView === 'detailed'
                    ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)] font-bold'
                    : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
                }`}
              >
                {isBn ? 'বিস্তারিত (Detailed)' : 'Detailed'}
              </button>
            </div>
          </div>

          {/* Table Density */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--hyper-text-secondary)]">
              {isBn ? 'টেবিলের ঘনত্ব' : 'Table Row Density'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTableDensity('comfortable')}
                className={`py-2.5 px-3 rounded-[16px] text-xs font-semibold border cursor-pointer ${
                  tableDensity === 'comfortable'
                    ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)] font-bold'
                    : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
                }`}
              >
                {isBn ? 'স্বাচ্ছন্দ্যময় (Comfortable)' : 'Comfortable'}
              </button>
              <button
                type="button"
                onClick={() => setTableDensity('compact')}
                className={`py-2.5 px-3 rounded-[16px] text-xs font-semibold border cursor-pointer ${
                  tableDensity === 'compact'
                    ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)] font-bold'
                    : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
                }`}
              >
                {isBn ? 'কমপ্যাক্ট (Compact)' : 'Compact'}
              </button>
            </div>
          </div>

          {/* Show Vacant Units Toggle */}
          <div className="p-3.5 rounded-[18px] bg-black/5 dark:bg-white/5 flex items-center justify-between pt-3">
            <div className="min-w-0 pr-2">
              <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
                {isBn ? 'খালি ফ্ল্যাট সারসংক্ষেপে দেখান' : 'Show Vacant Units in Billing'}
              </span>
              <p className="text-[11px] text-[var(--hyper-text-secondary)] mt-0.5">
                {isBn ? 'ভাড়া আদায় তালিকায় খালি ফ্ল্যাটের স্ট্যাটাস অন্তর্ভুক্ত রাখুন' : 'Include vacant units in the monthly billing table'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowVacantUnits(!showVacantUnits)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                showVacantUnits ? 'bg-[#22B84A]' : 'bg-black/20 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  showVacantUnits ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </HyperCard>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <PillButton variant="secondary" size="sm" onClick={handleReset} className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isBn ? 'ডিফল্ট সেটিংস' : 'Reset Defaults'}</span>
        </PillButton>
        <PillButton variant="primary" size="md" onClick={handleSave}>
          {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
        </PillButton>
      </div>
    </div>
  );
};
