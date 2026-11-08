import React, { useState } from 'react';
import {
  Coins,
  TrendingDown,
  ReceiptText,
  Wallet,
  UserPlus,
  BarChart3,
  Building2,
  Folder,
  Sun,
  Moon,
  Layers,
} from 'lucide-react';
import {
  HyperCard,
  StatTile,
  ActionTile,
  GroupedList,
  GroupedListItem,
  PillButton,
  FloatingPillNav,
  ModalWrapper,
} from './index';
import { useTheme } from '../../../contexts/ThemeContext';

export const HyperOSComponentShowcase: React.FC = () => {
  const { resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<'home' | 'accounts' | 'profile'>('home');

  return (
    <div className="min-h-screen hyper-ambient-bg py-6 px-4 sm:px-6 transition-colors duration-250 pb-28">
      {/* Top Bar with Brand & Theme Toggle */}
      <div className="max-w-md mx-auto mb-6">
        <HyperCard variant="floating" className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-white p-1.5 shadow-sm border border-black/5 dark:border-white/10 shrink-0">
              <img
                src="/brand/anwar-bhuiyan-property.svg"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[var(--hyper-text-primary)] leading-tight">
                HyperOS Design System
              </h1>
              <p className="text-[11px] text-[var(--hyper-text-secondary)]">
                Xiaomi Inspired Frosted Glass
              </p>
            </div>
          </div>

          {/* Theme Pill Toggle */}
          <div className="flex items-center bg-black/5 dark:bg-white/10 p-1 rounded-full border border-black/5 dark:border-white/10">
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
        </HyperCard>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {/* Section 1: StatTiles (Financial Metrics) */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--hyper-text-secondary)]">
              1. StatTile — Financial Cards
            </h2>
            <span className="text-[11px] text-[var(--hyper-text-tertiary)]">
              2-Column Grid
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="মোট জমা"
              subtitle="চলতি মাস"
              amount="৳০"
              icon={Coins}
              color="green"
              trend="up"
              trendText="আদায়"
            />
            <StatTile
              label="মোট বাকি"
              subtitle="বকেয়া প্রাপ্য"
              amount="৳০"
              icon={TrendingDown}
              color="red"
              trend="down"
              trendText="বকেয়া"
            />
            <StatTile
              label="মোট খরচ"
              subtitle="রক্ষণাবেক্ষণ"
              amount="৳০"
              icon={ReceiptText}
              color="orange"
            />
            <StatTile
              label="হাতে আছে"
              subtitle="উদ্বৃত্ত তহবিল"
              amount="৳০"
              icon={Wallet}
              color="blue"
            />
          </div>
        </div>

        {/* Section 2: ActionTiles (Xiaomi Squircle Quick Actions) */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--hyper-text-secondary)]">
              2. ActionTile — Quick Actions
            </h2>
            <span className="text-[11px] text-[var(--hyper-text-tertiary)]">
              Squircle Badges
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            <ActionTile
              label="ভাড়া জমা"
              icon={Wallet}
              color="green"
              onClick={() => setModalOpen(true)}
            />
            <ActionTile
              label="নতুন খরচ"
              icon={ReceiptText}
              color="orange"
              onClick={() => setModalOpen(true)}
            />
            <ActionTile
              label="ভাড়াটিয়া"
              icon={UserPlus}
              color="blue"
              onClick={() => setModalOpen(true)}
            />
            <ActionTile
              label="সকল হিসাব"
              icon={BarChart3}
              color="purple"
              onClick={() => setModalOpen(true)}
            />
          </div>
        </div>

        {/* Section 3: GroupedList (Xiaomi My Files & Phone Manager Style) */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--hyper-text-secondary)]">
              3. GroupedList — Inset Hairline Dividers
            </h2>
          </div>
          <GroupedList>
            <GroupedListItem
              title="আনোয়ার ভবন (প্রধান সম্পত্তি)"
              subtitle="১২টি ফ্ল্যাট • ১০টি ভাড়া দেওয়া"
              icon={Building2}
              iconBg="bg-[var(--hyper-green-bg)]"
              iconColor="text-[#22B84A]"
              trailing={
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  সক্রিয়
                </span>
              }
              onClick={() => {}}
            />
            <GroupedListItem
              title="ডিজিটাল খাতা ও ভাউচার ফাইল"
              subtitle="নভেম্বর ২০২৬ এর সকল হিসাব নথিপত্র"
              icon={Folder}
              iconBg="bg-[var(--hyper-blue-bg)]"
              iconColor="text-[#1685E8]"
              trailing={
                <span className="text-xs font-bold text-[var(--hyper-text-secondary)]">
                  ২৪ ফাইল
                </span>
              }
              onClick={() => {}}
            />
            <GroupedListItem
              title="সদস্য অনুমতি ও ভূমিকা নিয়ন্ত্রণ"
              subtitle="মাস্টার এডমিন, ম্যানেজার ও দর্শক ভূমিকা"
              icon={Layers}
              iconBg="bg-[var(--hyper-purple-bg)]"
              iconColor="text-[#7655E8]"
              isLast
              onClick={() => {}}
            />
          </GroupedList>
        </div>

        {/* Section 4: PillButtons (Capsule Controls) */}
        <div>
          <div className="flex items-center justify-between px-2 mb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--hyper-text-secondary)]">
              4. PillButton — Capsule Actions & Segmented
            </h2>
          </div>
          <HyperCard className="p-4 space-y-4">
            {/* Segmented Filter like Calls App */}
            <div className="bg-black/5 dark:bg-white/10 p-1 rounded-full flex gap-1">
              <PillButton
                variant="segmented"
                size="sm"
                active
                className="flex-1"
              >
                সকল হিসাব (All)
              </PillButton>
              <PillButton
                variant="segmented"
                size="sm"
                active={false}
                className="flex-1"
              >
                বকেয়া তালিকা (Due)
              </PillButton>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-wrap gap-2.5">
              <PillButton
                variant="primary"
                size="md"
                onClick={() => setModalOpen(true)}
              >
                মডেল পরীক্ষা (Open Modal)
              </PillButton>
              <PillButton
                variant="secondary"
                size="md"
                onClick={toggleTheme}
              >
                থিম পরিবর্তন ({resolvedTheme === 'light' ? 'Dark' : 'Light'})
              </PillButton>
            </div>
          </HyperCard>
        </div>

        {/* Section 5: ModalWrapper Showcase */}
        <ModalWrapper
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="নতুন খরচ অন্তর্ভুক্তি (New Expense)"
          subtitle="পারিবারিক প্রপার্টি খরচের বিবরণ ও রশিদ"
          submitText="খরচ সংরক্ষণ করুন"
          cancelText="বাতিল / Cancel"
          onSubmit={(e) => {
            e.preventDefault();
            setModalOpen(false);
          }}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-[var(--hyper-text-secondary)] mb-1.5">
                খরচের খাত / Category
              </label>
              <select className="w-full px-3.5 py-2.5 hyper-input-field font-medium">
                <option>বিদ্যুৎ বিল (Electricity)</option>
                <option>পানি বিল (Water)</option>
                <option>মেরামত ও রক্ষণাবেক্ষণ</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[var(--hyper-text-secondary)] mb-1.5">
                টাকার পরিমাণ (BDT)
              </label>
              <input
                type="number"
                placeholder="যেমন: ১৫০০"
                className="w-full px-3.5 py-2.5 hyper-input-field font-bold text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--hyper-text-secondary)] mb-1.5">
                বিবরণ / Notes
              </label>
              <textarea
                rows={3}
                placeholder="খরচের বিস্তারিত তথ্য লিখুন..."
                className="w-full px-3.5 py-2.5 hyper-input-field"
              />
            </div>
          </div>
        </ModalWrapper>
      </div>

      {/* Floating Navigation Pill at Bottom */}
      <FloatingPillNav
        activeSection={activeNav}
        drillDownView={null}
        onSelectSection={(sec) => setActiveNav(sec)}
        onOpenNewExpense={() => setModalOpen(true)}
        onOpenRentPayment={() => setModalOpen(true)}
      />
    </div>
  );
};

export default HyperOSComponentShowcase;
