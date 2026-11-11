import React, { useState } from 'react';
import { formatMoney, formatDate, formatMonth } from '../../../utils/uiFormatters';
import { Sun, Moon, Sparkles, Check } from 'lucide-react';

/**
 * Dev-Only Component & Token Gallery for Bhuiya Property Manager Design System v3.1
 * 
 * Reviews:
 * - Fill and Ink color pairs across all 6 semantic roles
 * - Surface & Canvas tokens in Light, Dark, and OLED modes
 * - Bengali Typography with >= 1.5 line-height metrics
 * - Centralized UI financial formatting (formatMoney, formatDate, formatMonth, formatNumber)
 */
export const DevComponentGallery: React.FC = () => {
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'oled'>('light');
  const [useBanglaDigits, setUseBanglaDigits] = useState(true);

  const testAmounts = [125000, 20000, 5500, 0, -4500, 15000000];
  const testDate = new Date();

  return (
    <div
      className={`min-h-screen p-4 sm:p-8 transition-colors duration-200 ${
        themeMode === 'oled'
          ? 'dark theme-oled bg-black text-[#F5F5F5]'
          : themeMode === 'dark'
          ? 'dark bg-[#0B0D10] text-[#F5F5F5]'
          : 'bg-[#F2F3F5] text-[#202124]'
      }`}
      style={{
        backgroundColor: 'var(--surface-canvas)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-bangla)',
        lineHeight: 'var(--lh-bangla)',
      }}
    >
      <div className="max-w-5xl mx-auto space-y-8 pb-16">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-primary-tint)] text-[var(--color-primary-ink)]">
                DEV ONLY
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-medium">Sprint S1a Gallery</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-[var(--text-primary)]">
              আনোয়ার ভূঁইয়া ডিজাইন সিস্টেম v3.1
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              Fill & Ink Tokens, Theme Surfaces, Bengali Typography & Financial Formatters
            </p>
          </div>

          {/* Theme & Numeral Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-2xl bg-[var(--surface-input)] p-1 border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  themeMode === 'light'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  themeMode === 'dark'
                    ? 'bg-[#181A1F] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('oled')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  themeMode === 'oled'
                    ? 'bg-black text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>OLED</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setUseBanglaDigits(!useBanglaDigits)}
              className="px-3 py-2 rounded-2xl bg-[var(--surface-input)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
            >
              সংখ্যা: {useBanglaDigits ? 'বাংলা (১২৩)' : 'English (123)'}
            </button>
          </div>
        </div>

        {/* Section 1: Fill & Ink Semantic Color Tokens */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span>১. সেমান্টিক ফিল ও ইংক কালার টোকেন (Fill & Ink Pairs)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Primary / Paid */}
            <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Primary / Paid</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-primary-tint)] text-[var(--color-primary-ink)]">
                  পরিশোধিত
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-primary-fill)' }}
                >
                  <Check className="w-5 h-5 text-white" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">Fill: #22B84A</div>
                  <div className="font-medium" style={{ color: 'var(--color-primary-ink)' }}>
                    Ink: var(--color-primary-ink)
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary / Property */}
            <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Secondary / Property</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-secondary-tint)] text-[var(--color-secondary-ink)]">
                  প্রপার্টি
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-secondary-fill)' }}
                >
                  P
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">Fill: #0D9488</div>
                  <div className="font-medium" style={{ color: 'var(--color-secondary-ink)' }}>
                    Ink: var(--color-secondary-ink)
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive / Info */}
            <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Info / Action</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-info-tint)] text-[var(--color-info-ink)]">
                  তথ্য
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-info-fill)' }}
                >
                  i
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">Fill: #1685E8</div>
                  <div className="font-medium" style={{ color: 'var(--color-info-ink)' }}>
                    Ink: var(--color-info-ink)
                  </div>
                </div>
              </div>
            </div>

            {/* Warning / Expense */}
            <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Expense / Warning</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-warning-tint)] text-[var(--color-warning-ink)]">
                  খরচ
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-warning-fill)' }}
                >
                  !
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">Fill: #F28A24</div>
                  <div className="font-medium" style={{ color: 'var(--color-warning-ink)' }}>
                    Ink: var(--color-warning-ink)
                  </div>
                </div>
              </div>
            </div>

            {/* Danger / Due */}
            <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Due / Danger</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-danger-tint)] text-[var(--color-danger-ink)]">
                  বকেয়া
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-danger-fill)' }}
                >
                  ✕
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">Fill: #E94B4B</div>
                  <div className="font-medium" style={{ color: 'var(--color-danger-ink)' }}>
                    Ink: var(--color-danger-ink)
                  </div>
                </div>
              </div>
            </div>

            {/* Admin / Reserve */}
            <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Admin / Reserve</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-admin-tint)] text-[var(--color-admin-ink)]">
                  রিজার্ভ
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-admin-fill)' }}
                >
                  ★
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">Fill: #7655E8</div>
                  <div className="font-medium" style={{ color: 'var(--color-admin-ink)' }}>
                    Ink: var(--color-admin-ink)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Bengali Typography Scale & Line-Height Integrity */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            ২. বাংলা টাইপোগ্রাফি স্কেল ও কার/ফলা ক্লিপিং টেস্ট (Line Height ≥ 1.5)
          </h2>
          <div className="p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4">
            <div>
              <span className="text-[11px] font-bold uppercase text-[var(--text-secondary)] tracking-wider block">
                Display (28px / 36px / 800)
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
                আনোয়ার ভূঁইয়া প্রপার্টি ম্যানেজমেন্ট
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-[var(--text-secondary)] tracking-wider block">
                Page Title (22px / 30px / 700)
              </span>
              <p className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                ভাড়া আদায় ও আয়-ব্যয় বিবরণী খাতা
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-[var(--text-secondary)] tracking-wider block">
                Vowel Clipping Diagnostic (কার, ফলা, ি, ী, ু, ূ, ্য, ্ত্ব)
              </span>
              <p className="text-base sm:text-lg font-medium text-[var(--text-primary)] leading-relaxed">
                বাড়ি ভাড়াটিয়াদের বিদ্যুৎ বিল, গ্যাস বিল ও নিরাপত্তা জামানতের সম্পূর্ণ হিসাব। কনিষ্ঠ, জ্যেষ্ঠ, দৃষ্টিকোণ, দৃষ্টিভঙ্গি ও স্বকীয় বৈশিষ্ট্যের মূল্যায়ন।
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Financial Formatters (Lakh/Crore Grouping) */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            ৩. আর্থিক সংখ্যা ফরম্যাটিং (Lakh/Crore Grouping & Asia/Dhaka)
          </h2>
          <div className="p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {testAmounts.map((amt) => (
                <div key={amt} className="p-3 rounded-2xl bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
                  <span className="text-[11px] text-[var(--text-secondary)] block">ইনপুট: {amt}</span>
                  <span className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-[var(--text-primary)]">
                    {formatMoney(amt, { useBanglaDigits })}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
                <span className="text-[11px] text-[var(--text-secondary)] block">formatDate (Numeric)</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {formatDate(testDate, { useBanglaDigits })}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
                <span className="text-[11px] text-[var(--text-secondary)] block">formatDate (Long)</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {formatDate(testDate, { variant: 'long', useBanglaDigits })}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)]">
                <span className="text-[11px] text-[var(--text-secondary)] block">formatMonth</span>
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  {formatMonth('2026-11', { useBanglaDigits })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevComponentGallery;
