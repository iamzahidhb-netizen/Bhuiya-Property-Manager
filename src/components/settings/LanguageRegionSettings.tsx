import React, { useState } from 'react';
import { Languages, Check, RefreshCw } from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';

export const LanguageRegionSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage, setLanguage } = useLanguage();

  const [lang, setLocalLang] = useState<'bn' | 'en'>(settings.languageRegion.language || currentLanguage);
  const [useBanglaNumerals, setUseBanglaNumerals] = useState(settings.languageRegion.useBanglaNumerals);
  const [dateFormat, setDateFormat] = useState(settings.languageRegion.dateFormat);
  const [timeFormat, setTimeFormat] = useState(settings.languageRegion.timeFormat);

  const isBn = currentLanguage === 'bn';

  function handleSave() {
    updateSettings({
      languageRegion: {
        ...settings.languageRegion,
        language: lang,
        useBanglaNumerals,
        dateFormat,
        timeFormat,
      },
    });
    setLanguage(lang);
  }

  function handleReset() {
    setLocalLang('bn');
    setUseBanglaNumerals(false);
    setDateFormat('DD/MM/YYYY');
    setTimeFormat('12h');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'ভাষা ও আঞ্চলিক পছন্দ' : 'Language & Region'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'ভাষা, সংখ্যা বিন্যাস এবং তারিখ প্রদর্শন' : 'Application language, number & date display'}
          </p>
        </div>
        <PillButton variant="ghost" size="sm" onClick={onBack}>
          ← {isBn ? 'ফিরে যান' : 'Back'}
        </PillButton>
      </div>

      {/* Language Selection Card */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-blue-bg)] flex items-center justify-center shrink-0">
            <Languages className="w-5 h-5 text-[#1685E8]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'অ্যাপ্লিকেশন ভাষা' : 'Application Language'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'সম্পূর্ণ অ্যাপের ইন্টারফেস ভাষা পরিবর্তন করুন' : 'Change global interface language'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLocalLang('bn')}
            className={`p-3.5 rounded-[20px] border text-left transition-all duration-150 flex items-center justify-between cursor-pointer ${
              lang === 'bn'
                ? 'bg-emerald-500/10 border-[#22B84A] text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
            }`}
          >
            <div>
              <div className="text-sm font-bold">বাংলা</div>
              <div className="text-[11px] text-[var(--hyper-text-secondary)]">Bangla</div>
            </div>
            {lang === 'bn' && <Check className="w-5 h-5 text-[#22B84A]" />}
          </button>

          <button
            type="button"
            onClick={() => setLocalLang('en')}
            className={`p-3.5 rounded-[20px] border text-left transition-all duration-150 flex items-center justify-between cursor-pointer ${
              lang === 'en'
                ? 'bg-emerald-500/10 border-[#22B84A] text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
            }`}
          >
            <div>
              <div className="text-sm font-bold">English</div>
              <div className="text-[11px] text-[var(--hyper-text-secondary)]">ইংরেজি</div>
            </div>
            {lang === 'en' && <Check className="w-5 h-5 text-[#22B84A]" />}
          </button>
        </div>
      </HyperCard>

      {/* Regional Formats Card */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
          {isBn ? 'আঞ্চলিক সংখ্যা ও সময় ফরম্যাট' : 'Regional Number & Time Formats'}
        </h4>

        {/* Bengali Numerals Toggle */}
        <div className="flex items-center justify-between p-3 rounded-[18px] bg-black/5 dark:bg-white/5">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-[var(--hyper-text-primary)]">
              {isBn ? 'বাংলা সংখ্যা (১, ২, ৩)' : 'Use Bengali Digits (১, ২, ৩)'}
            </div>
            <div className="text-[11px] text-[var(--hyper-text-secondary)]">
              {isBn ? 'টাকা ও সংখ্যার জন্য বাংলা অংক ব্যবহার করুন' : 'Format currency & numbers with Bengali numerals'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={useBanglaNumerals}
            onChange={(e) => setUseBanglaNumerals(e.target.checked)}
            className="w-5 h-5 rounded-md accent-[#22B84A] cursor-pointer"
          />
        </div>

        {/* Date Format Selector */}
        <div>
          <label className="block text-xs font-semibold text-[var(--hyper-text-secondary)] mb-1.5">
            {isBn ? 'তারিখ প্রদর্শন ফরম্যাট' : 'Date Format'}
          </label>
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value as 'DD/MM/YYYY' | 'DD MMM YYYY' | 'YYYY-MM-DD')}
            className="w-full px-3.5 py-2.5 rounded-[18px] hyper-input-field text-xs sm:text-sm font-medium"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY (যেমন: 09/11/2026)</option>
            <option value="DD MMM YYYY">DD MMM YYYY (যেমন: 09 Nov 2026)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601: 2026-11-09)</option>
          </select>
        </div>

        {/* Time Format */}
        <div>
          <label className="block text-xs font-semibold text-[var(--hyper-text-secondary)] mb-1.5">
            {isBn ? 'সময় ফরম্যাট' : 'Time Format'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTimeFormat('12h')}
              className={`p-2.5 rounded-[16px] text-xs font-bold border cursor-pointer transition ${
                timeFormat === '12h'
                  ? 'bg-[#22B84A] text-white border-transparent'
                  : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
              }`}
            >
              12-Hour (AM / PM)
            </button>
            <button
              type="button"
              onClick={() => setTimeFormat('24h')}
              className={`p-2.5 rounded-[16px] text-xs font-bold border cursor-pointer transition ${
                timeFormat === '24h'
                  ? 'bg-[#22B84A] text-white border-transparent'
                  : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
              }`}
            >
              24-Hour (14:30)
            </button>
          </div>
        </div>

        {/* Currency Info */}
        <div className="p-3 rounded-[18px] bg-black/5 dark:bg-white/5 flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--hyper-text-secondary)]">
            {isBn ? 'মুদ্রা' : 'Currency'}
          </span>
          <span className="font-bold text-[var(--hyper-text-primary)]">
            BDT (৳ - বাংলাদেশী টাকা)
          </span>
        </div>
      </HyperCard>

      {/* Save & Reset Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <PillButton variant="secondary" size="md" onClick={handleReset}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          {isBn ? 'ডিফল্ট করুন' : 'Reset Defaults'}
        </PillButton>
        <PillButton variant="primary" size="md" onClick={handleSave}>
          {isBn ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes'}
        </PillButton>
      </div>
    </div>
  );
};

export default LanguageRegionSettings;
