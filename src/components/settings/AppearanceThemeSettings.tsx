import React, { useState } from 'react';
import { Palette, Sun, Moon, Laptop, Sparkles, Check, RefreshCw } from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { AppTheme, AccentColor } from '../../types/settings';

export const AppearanceThemeSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(settings.appearance.theme || theme);
  const [accentColor, setAccentColor] = useState<AccentColor>(settings.appearance.accentColor || 'green');
  const [cardStyle, setCardStyle] = useState<'glass' | 'solid'>(settings.appearance.cardStyle || 'glass');
  const [layoutDensity, setLayoutDensity] = useState<'comfortable' | 'compact'>(settings.appearance.layoutDensity || 'comfortable');

  const isBn = currentLanguage === 'bn';

  function handleSave() {
    updateSettings({
      appearance: {
        theme: selectedTheme,
        accentColor,
        cardStyle,
        layoutDensity,
      },
    });
    setTheme(selectedTheme);
  }

  function handleReset() {
    setSelectedTheme('light');
    setAccentColor('green');
    setCardStyle('glass');
    setLayoutDensity('comfortable');
    setTheme('light');
  }

  const ACCENTS: { id: AccentColor; nameBn: string; nameEn: string; hex: string; bgClass: string }[] = [
    { id: 'green', nameBn: 'হাইপার গ্রিন', nameEn: 'Hyper Green', hex: '#22B84A', bgClass: 'bg-[#22B84A]' },
    { id: 'blue', nameBn: 'স্কাই ব্লু', nameEn: 'Sky Blue', hex: '#1685E8', bgClass: 'bg-[#1685E8]' },
    { id: 'orange', nameBn: 'সান অরেঞ্জ', nameEn: 'Sun Orange', hex: '#F28A24', bgClass: 'bg-[#F28A24]' },
    { id: 'purple', nameBn: 'রয়্যাল পার্পল', nameEn: 'Royal Purple', hex: '#7655E8', bgClass: 'bg-[#7655E8]' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'অ্যাপিয়ারেন্স ও থিম' : 'Appearance & Theme'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'লাইট/ডার্ক মোড, অ্যাকসেন্ট কালার এবং কার্ড স্টাইল' : 'Light/Dark modes, accent colors, and styling'}
          </p>
        </div>
        <PillButton variant="ghost" size="sm" onClick={onBack}>
          ← {isBn ? 'ফিরে যান' : 'Back'}
        </PillButton>
      </div>

      {/* Theme Mode Card */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-orange-bg)] flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5 text-[#F28A24]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'থিম মোড' : 'Theme Mode'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'আপনার পছন্দের ইন্টারফেস থিম নির্বাচন করুন' : 'Select your preferred visual mode'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Light */}
          <button
            type="button"
            onClick={() => {
              setSelectedTheme('light');
              setTheme('light');
            }}
            className={`p-3 rounded-[20px] border flex flex-col items-center gap-2 text-center transition-all cursor-pointer ${
              selectedTheme === 'light'
                ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <Sun className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">{isBn ? 'লাইট' : 'Light'}</span>
          </button>

          {/* Dark */}
          <button
            type="button"
            onClick={() => {
              setSelectedTheme('dark');
              setTheme('dark');
            }}
            className={`p-3 rounded-[20px] border flex flex-col items-center gap-2 text-center transition-all cursor-pointer ${
              selectedTheme === 'dark'
                ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-300 flex items-center justify-center">
              <Moon className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">{isBn ? 'ডার্ক' : 'Dark'}</span>
          </button>

          {/* System */}
          <button
            type="button"
            onClick={() => {
              setSelectedTheme('system');
              setTheme('system');
            }}
            className={`p-3 rounded-[20px] border flex flex-col items-center gap-2 text-center transition-all cursor-pointer ${
              selectedTheme === 'system'
                ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center">
              <Laptop className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">{isBn ? 'সিস্টেম' : 'System'}</span>
          </button>
        </div>
      </HyperCard>

      {/* Accent Color Card */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-green-bg)] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#22B84A]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'অ্যাকসেন্ট কালার' : 'Accent Color'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'হাইলাইট বাটন এবং ব্যাজের প্রাইমারি কালার' : 'Primary color for badges & active states'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {ACCENTS.map((accent) => {
            const isSelected = accentColor === accent.id;
            return (
              <button
                key={accent.id}
                type="button"
                onClick={() => setAccentColor(accent.id)}
                className={`p-3 rounded-[20px] border flex items-center gap-2.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[var(--hyper-border)] bg-black/5 dark:bg-white/10 shadow-xs'
                    : 'border-transparent bg-black/5 dark:bg-white/5 opacity-80'
                }`}
              >
                <div className={`w-6 h-6 rounded-full ${accent.bgClass} flex items-center justify-center text-white shrink-0 shadow-xs`}>
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs font-bold truncate text-[var(--hyper-text-primary)]">
                    {isBn ? accent.nameBn : accent.nameEn}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </HyperCard>

      {/* Card Style & Density */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-[var(--hyper-text-primary)] mb-1">
            {isBn ? 'কার্ড স্টাইল ও ঘনত্ব' : 'Card Styling & Layout Density'}
          </h4>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'ফ্রস্টেড গ্লাস এফেক্ট ও স্পেসিং লেভেল' : 'Frosted glass effect and padding intensity'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Card Style */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--hyper-text-secondary)]">
              {isBn ? 'কার্ড ফিনিশিং' : 'Card Finish'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCardStyle('glass')}
                className={`py-2 px-3 rounded-[16px] text-xs font-semibold border cursor-pointer ${
                  cardStyle === 'glass'
                    ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)]'
                    : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
                }`}
              >
                {isBn ? 'ফ্রস্টেড গ্লাস' : 'Frosted Glass'}
              </button>
              <button
                type="button"
                onClick={() => setCardStyle('solid')}
                className={`py-2 px-3 rounded-[16px] text-xs font-semibold border cursor-pointer ${
                  cardStyle === 'solid'
                    ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)]'
                    : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
                }`}
              >
                {isBn ? 'সলিড মিনিমাল' : 'Solid Minimal'}
              </button>
            </div>
          </div>

          {/* Layout Density */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--hyper-text-secondary)]">
              {isBn ? 'লেআউট ঘনত্ব' : 'Density'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLayoutDensity('comfortable')}
                className={`py-2 px-3 rounded-[16px] text-xs font-semibold border cursor-pointer ${
                  layoutDensity === 'comfortable'
                    ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)]'
                    : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
                }`}
              >
                {isBn ? 'স্বাচ্ছন্দ্যময়' : 'Comfortable'}
              </button>
              <button
                type="button"
                onClick={() => setLayoutDensity('compact')}
                className={`py-2 px-3 rounded-[16px] text-xs font-semibold border cursor-pointer ${
                  layoutDensity === 'compact'
                    ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)]'
                    : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
                }`}
              >
                {isBn ? 'কমপ্যাক্ট' : 'Compact'}
              </button>
            </div>
          </div>
        </div>
      </HyperCard>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <PillButton variant="secondary" size="sm" onClick={handleReset} className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isBn ? 'ডিফল্ট থিম' : 'Reset Defaults'}</span>
        </PillButton>
        <PillButton variant="primary" size="md" onClick={handleSave}>
          {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
        </PillButton>
      </div>
    </div>
  );
};
