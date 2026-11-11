import React, { useState } from 'react';
import { Languages, RefreshCw, Calendar, Globe } from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { BackIconButton } from '../ui/hyperos/BackIconButton';
import { FrostedGlassSelect, type FrostedGlassOption } from '../ui/hyperos/FrostedGlassSelect';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';

const LANGUAGE_OPTIONS: FrostedGlassOption<'bn' | 'en'>[] = [
  {
    value: 'bn',
    labelBn: 'বাংলা',
    labelEn: 'Bangla (Bengali)',
    descriptionBn: 'সম্পূর্ণ ইন্টারফেস বাংলায় প্রদর্শন করুন',
    descriptionEn: 'Display entire interface in Bengali',
    icon: Globe,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-[#22B84A]',
    badge: 'ডিফল্ট',
  },
  {
    value: 'en',
    labelBn: 'English',
    labelEn: 'English (US/UK)',
    descriptionBn: 'ইংরেজি ভাষায় অ্যাপ পরিচালনা করুন',
    descriptionEn: 'Switch interface language to English',
    icon: Globe,
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-[#1685E8]',
  },
];

const DATE_FORMAT_OPTIONS: FrostedGlassOption<'DD/MM/YYYY' | 'DD MMM YYYY' | 'YYYY-MM-DD'>[] = [
  {
    value: 'DD/MM/YYYY',
    labelBn: 'DD/MM/YYYY (০৯/১১/২০২৬)',
    labelEn: 'DD/MM/YYYY (09/11/2026)',
    descriptionBn: 'দিন/মাস/বছর ব্রিটিশ ফরম্যাট (বাংলাদেশ স্ট্যান্ডার্ড)',
    descriptionEn: 'Day/Month/Year British format (BD standard)',
    icon: Calendar,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-[#22B84A]',
  },
  {
    value: 'DD MMM YYYY',
    labelBn: 'DD MMM YYYY (০৯ নভে ২০২৬)',
    labelEn: 'DD MMM YYYY (09 Nov 2026)',
    descriptionBn: 'সংক্ষিপ্ত মাসের নামসহ সহজবোধ্য ফরম্যাট',
    descriptionEn: 'Formatted with abbreviated month name',
    icon: Calendar,
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-[#1685E8]',
  },
  {
    value: 'YYYY-MM-DD',
    labelBn: 'YYYY-MM-DD (২০২৬-১১-০৯)',
    labelEn: 'YYYY-MM-DD (2026-11-09)',
    descriptionBn: 'আন্তর্জাতিক স্ট্যান্ডার্ড (ISO 8601)',
    descriptionEn: 'International ISO standard format',
    icon: Calendar,
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-[#7655E8]',
  },
];

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
        <BackIconButton onClick={onBack} aria-label={isBn ? 'ফিরে যান' : 'Back'} />
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

        {/* Frosted Glass Language Selector */}
        <div>
          <label className="block text-xs font-semibold text-[var(--hyper-text-secondary)] mb-1.5">
            {isBn ? 'ভাষা নির্বাচন করুন' : 'Select Interface Language'}
          </label>
          <FrostedGlassSelect<'bn' | 'en'>
            id="app-language-select"
            value={lang}
            onChange={(newLang) => setLocalLang(newLang)}
            options={LANGUAGE_OPTIONS}
            titleBn="অ্যাপ্লিকেশন ভাষা"
            titleEn="Application Language"
            subtitleBn="সম্পূর্ণ ইন্টারফেস ভাষা পরিবর্তন করুন"
            subtitleEn="Choose interface display language"
            headerIcon={Globe}
            headerIconBg="bg-[var(--hyper-green-bg)]"
            headerIconColor="text-[#1685E8]"
            triggerTestId="language-frosted-trigger"
            modalTestId="language-frosted-modal"
          />
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
          <FrostedGlassSelect<'DD/MM/YYYY' | 'DD MMM YYYY' | 'YYYY-MM-DD'>
            id="app-date-format-select"
            value={dateFormat}
            onChange={(newFormat) => setDateFormat(newFormat)}
            options={DATE_FORMAT_OPTIONS}
            titleBn="তারিখ প্রদর্শন ফরম্যাট"
            titleEn="Date Display Format"
            subtitleBn="অ্যাপের সর্বস্তরে তারিখ প্রদর্শনের বিন্যাস বাছাই করুন"
            subtitleEn="Choose how dates appear throughout the application"
            headerIcon={Calendar}
            headerIconBg="bg-[#22B84A]/15"
            headerIconColor="text-[#22B84A]"
            triggerTestId="date-format-frosted-trigger"
            modalTestId="date-format-frosted-modal"
          />
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
