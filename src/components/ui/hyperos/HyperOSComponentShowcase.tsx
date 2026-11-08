import React, { useState } from 'react';
import {
  Calendar,
  UserRound,
  ArrowDownLeft,
  Hourglass,
  TrendingDown,
  Coins,
  Sun,
  Moon,
} from 'lucide-react';
import {
  HyperCard,
  StatTile,
  FloatingPillNav,
  ModalWrapper,
} from './index';
import { SettingsCenter } from '../../settings/SettingsCenter';
import type { SettingsCategoryId } from '../../settings/SettingsHome';
import { useTheme } from '../../../contexts/ThemeContext';

export const HyperOSComponentShowcase: React.FC = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'home' | 'accounts' | 'profile'>('home');
  const [testOverflow, setTestOverflow] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategoryId | null>(null);

  React.useEffect(() => {
    (window as unknown as { __setSettingsCategory?: (cat: SettingsCategoryId | null) => void }).__setSettingsCategory = (cat) => {
      setActiveSection('profile');
      setSettingsCategory(cat);
    };
  }, []);

  return (
    <div className="min-h-screen hyper-ambient-bg flex flex-col text-[var(--hyper-text-primary)] antialiased relative overflow-x-hidden transition-colors duration-250">
      {/* Dynamic Ambient Background Highlights */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true" style={{ contain: 'strict' }}>
        <div className="absolute top-10 right-10 w-[500px] h-[500px] bg-[#22B84A]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-[450px] h-[450px] bg-[#1685E8]/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-[600px] h-[600px] bg-[#22B84A]/5 rounded-full blur-3xl" />
      </div>

      {/* 1. TOP HEADER (Phase 3.1) */}
      <header className="sticky top-0 z-40 bg-[var(--hyper-bg-card)]/80 backdrop-blur-xl border-b border-[var(--hyper-border-subtle)] shadow-xs transition-colors duration-200">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Official Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[16px] bg-white dark:bg-[#252528] p-1.5 shadow-sm border border-[var(--hyper-border-subtle)] flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/brand/anwar-bhuiyan-property.svg"
                alt="Anwar Bhuiyan Property Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--hyper-text-primary)] leading-tight">
                আনোয়ার ভূঁইয়া প্রপার্টি
              </h1>
              <p className="text-xs text-[var(--hyper-text-secondary)] font-medium">
                পারিবারিক ডিজিটাল প্রপার্টি ও আর্থিক খাতা
              </p>
            </div>
          </div>

          {/* Theme Pill Toggle */}
          <div className="flex items-center bg-black/5 dark:bg-white/10 p-1 rounded-full border border-black/5 dark:border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setTheme('light')}
              aria-label="Light mode"
              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                resolvedTheme === 'light'
                  ? 'bg-white text-amber-500 shadow-xs'
                  : 'text-[var(--hyper-text-secondary)]'
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              aria-label="Dark mode"
              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                resolvedTheme === 'dark'
                  ? 'bg-[#303034] text-sky-400 shadow-xs'
                  : 'text-[var(--hyper-text-secondary)]'
              }`}
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN HOME VIEW CONTAINER */}
      <main className="max-w-md mx-auto px-4 pt-4 pb-32 pb-[calc(env(safe-area-inset-bottom)+7rem)] flex-1 w-full space-y-4">
        {/* Test Control Pill Bar */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-[var(--hyper-text-secondary)] uppercase tracking-wider">
            {activeSection === 'profile' ? 'Phase 3.2: অ্যাডমিন সেটিংস সেন্টার' : 'Phase 3.1: হোম ড্যাশবোর্ড'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSection(activeSection === 'profile' ? 'home' : 'profile')}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#22B84A]/10 text-[#22B84A] hover:bg-[#22B84A]/20 cursor-pointer"
            >
              {activeSection === 'profile' ? 'হোমে ফিরে যান' : 'সেটিংস সেন্টার খুলুন'}
            </button>
            {activeSection === 'home' && (
              <button
                type="button"
                onClick={() => setTestOverflow(!testOverflow)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[var(--hyper-text-primary)] hover:bg-black/10 cursor-pointer"
              >
                {testOverflow ? '৳০' : '৳১২,৩৪,৫৬৭'}
              </button>
            )}
          </div>
        </div>

        {activeSection === 'profile' && (
          <SettingsCenter
            key={settingsCategory || 'root'}
            initialCategory={settingsCategory}
          />
        )}

        {activeSection === 'home' && (
          <>
            {/* Top Row: Date Card & Authenticated User Card */}
            <div className="grid grid-cols-2 gap-3">
          {/* Date Card */}
          <HyperCard className="p-3.5 sm:p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-[var(--hyper-green-bg)] text-[#22B84A] flex items-center justify-center shrink-0 border border-[#22B84A]/20">
              <Calendar className="w-5 h-5 text-[#22B84A]" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[var(--hyper-text-primary)] truncate">
                আজ: সোমবার
              </div>
              <div className="text-xs sm:text-sm text-[var(--hyper-text-secondary)] font-medium truncate mt-0.5">
                ৯ নভেম্বর ২০২৬
              </div>
            </div>
          </HyperCard>

          {/* Authenticated User Name Card */}
          <HyperCard className="p-3.5 sm:p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-[var(--hyper-purple-bg)] text-[#7655E8] flex items-center justify-center shrink-0 border border-[#7655E8]/20">
              <UserRound className="w-5 h-5 text-[#7655E8]" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-[var(--hyper-text-secondary)] truncate">
                মাস্টার এডমিন
              </div>
              <div className="text-sm sm:text-base font-bold text-[var(--hyper-text-primary)] truncate mt-0.5">
                Zahid
              </div>
            </div>
          </HyperCard>
        </div>

        {/* Exactly 4 Financial Summary Cards in a 2-Column Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card 1: মোট জমা */}
          <StatTile
            label="মোট জমা"
            subtitle="নভেম্বর ২০২৬"
            amount={testOverflow ? '৳১২,৩৪,৫৬৭' : '৳০'}
            icon={ArrowDownLeft}
            color="green"
            trend="up"
            trendText="আদায়"
          />

          {/* Card 2: মোট বাকি */}
          <StatTile
            label="মোট বাকি"
            subtitle="অবশিষ্ট বকেয়া আদায়যোগ্য"
            amount={testOverflow ? '৳৮,৯০,১২৩' : '৳০'}
            icon={Hourglass}
            color="red"
            trend="down"
            trendText="বকেয়া"
          />

          {/* Card 3: মোট খরচ */}
          <StatTile
            label="মোট খরচ"
            subtitle="রক্ষণাবেক্ষণ ও বিল"
            amount={testOverflow ? '৳৪,৫৬,৭৮৯' : '৳০'}
            icon={TrendingDown}
            color="orange"
          />

          {/* Card 4: হাতে আছে (Cash in hand) */}
          <StatTile
            label="হাতে আছে"
            subtitle="আদায় থেকে খরচ বাদে উদ্বৃত্ত"
            amount={testOverflow ? '৳৭,৭৭,৭৭৮' : '৳০'}
            icon={Coins}
            color="blue"
          />
        </div>

        {/* Overflow Stress Test: Long Bengali Label Guarantee */}
        {testOverflow && (
          <HyperCard variant="subtle" className="p-4 space-y-2 text-xs">
            <div className="font-bold text-[var(--hyper-text-primary)]">
              দীর্ঘ বাংলা টেক্সট ও কন্টেইনার স্ট্রেস টেস্ট:
            </div>
            <div className="text-[var(--hyper-text-secondary)] leading-relaxed">
              পারিবারিক সম্পত্তি, ফ্ল্যাট ভাড়াটিয়া, মাসিক আয়-ব্যয় এবং স্বচ্ছ মুনাফা বণ্টন ও রিজার্ভ ফান্ডের সমন্বিত ডিজিটাল প্ল্যাটফর্ম। কোনো টেক্সট ওভারফ্লো বা হরাইজন্টাল স্ক্রলবার নেই।
            </div>
          </HyperCard>
        )}
          </>
        )}
      </main>

      {/* 3. FIXED BOTTOM FIVE-OPTION FLOATING PILL NAVIGATION DOCK */}
      <FloatingPillNav
        activeSection={activeSection}
        drillDownView={null}
        onSelectSection={(sec) => setActiveSection(sec)}
        onOpenNewExpense={() => setModalOpen(true)}
        onOpenRentPayment={() => setModalOpen(true)}
      />

      {/* Modal Test Verification */}
      <ModalWrapper
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="নতুন খরচ অন্তর্ভুক্তি (New Expense)"
        subtitle="পারিবারিক প্রপার্টি খরচের বিবরণ ও রশিদ"
        submitText="সংরক্ষণ করুন"
        onSubmit={(e) => {
          e.preventDefault();
          setModalOpen(false);
        }}
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[var(--hyper-text-secondary)] mb-1.5">
              খরচের খাত
            </label>
            <select className="w-full px-3.5 py-2.5 hyper-input-field font-medium">
              <option>বিদ্যুৎ বিল (Electricity)</option>
              <option>পানি বিল (Water)</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-[var(--hyper-text-secondary)] mb-1.5">
              টাকার পরিমাণ (BDT)
            </label>
            <input
              type="number"
              placeholder="১৫০০"
              className="w-full px-3.5 py-2.5 hyper-input-field font-bold text-sm"
            />
          </div>
        </div>
      </ModalWrapper>
    </div>
  );
};

export default HyperOSComponentShowcase;
