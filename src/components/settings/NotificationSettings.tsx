import React, { useState } from 'react';
import {
  Bell,
  CalendarCheck,
  AlertTriangle,
  WifiOff,
  Vibrate,
  RefreshCw,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { DEFAULT_SETTINGS } from '../../types/settings';

export const NotificationSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const [rentDueReminders, setRentDueReminders] = useState(
    settings.notifications.rentDueReminders
  );
  const [expenseAlerts, setExpenseAlerts] = useState(
    settings.notifications.expenseAlerts
  );
  const [offlineBanner, setOfflineBanner] = useState(
    settings.notifications.offlineBanner
  );
  const [hapticFeedback, setHapticFeedback] = useState(
    settings.notifications.hapticFeedback
  );

  function handleSave() {
    updateSettings({
      notifications: {
        rentDueReminders,
        expenseAlerts,
        offlineBanner,
        hapticFeedback,
      },
    });
  }

  function handleReset() {
    setRentDueReminders(DEFAULT_SETTINGS.notifications.rentDueReminders);
    setExpenseAlerts(DEFAULT_SETTINGS.notifications.expenseAlerts);
    setOfflineBanner(DEFAULT_SETTINGS.notifications.offlineBanner);
    setHapticFeedback(DEFAULT_SETTINGS.notifications.hapticFeedback);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'নোটিফিকেশন ও অ্যালার্ট' : 'Notifications & Alerts'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'বকেয়া তাগাদা, খরচ সতর্কতা এবং সিস্টেম বার্তা' : 'Due reminders, alerts & system notices'}
          </p>
        </div>
        <PillButton variant="ghost" size="sm" onClick={onBack}>
          ← {isBn ? 'ফিরে যান' : 'Back'}
        </PillButton>
      </div>

      {/* Preferences List */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-orange-bg)] flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-[#F28A24]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'সতর্কতা নিয়ন্ত্রণ' : 'Alert Preferences'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'আপনার পছন্দমতো পুশ ও ইন-অ্যাপ বার্তা সমন্বয় করুন' : 'Configure in-app alert banners & notifications'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Rent Due Reminders */}
          <div className="p-3.5 rounded-[18px] bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-[12px] bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-4 h-4 text-[#22B84A]" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
                  {isBn ? 'ভাড়া বকেয়া রিমাইন্ডার' : 'Rent Due Reminders'}
                </span>
                <p className="text-[11px] text-[var(--hyper-text-secondary)] mt-0.5">
                  {isBn ? 'নির্ধারিত তারিখ পার হলে বকেয়া ভাড়ার লাল ব্যাজ দেখান' : 'Show overdue badges after due threshold date'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRentDueReminders(!rentDueReminders)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                rentDueReminders ? 'bg-[#22B84A]' : 'bg-black/20 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  rentDueReminders ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Expense Alerts */}
          <div className="p-3.5 rounded-[18px] bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-[12px] bg-orange-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#F28A24]" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
                  {isBn ? 'ব্যয় সতর্কতা অ্যালার্ট' : 'High Expense Alerts'}
                </span>
                <p className="text-[11px] text-[var(--hyper-text-secondary)] mt-0.5">
                  {isBn ? 'অস্বাভাবিক বা অতিরিক্ত ব্যয়ের খতিয়ানে সতর্কতা দেখান' : 'Highlight unusually high expense transactions'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpenseAlerts(!expenseAlerts)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                expenseAlerts ? 'bg-[#22B84A]' : 'bg-black/20 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  expenseAlerts ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Offline Banner */}
          <div className="p-3.5 rounded-[18px] bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-[12px] bg-rose-500/10 flex items-center justify-center shrink-0">
                <WifiOff className="w-4 h-4 text-[#E94B4B]" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
                  {isBn ? 'ইন্টারনেট বিচ্ছিন্নতা ব্যানার' : 'Offline Status Banner'}
                </span>
                <p className="text-[11px] text-[var(--hyper-text-secondary)] mt-0.5">
                  {isBn ? 'নেটওয়ার্ক সংযোগ না থাকলে শীর্ষে তথ্য ব্যানার দেখান' : 'Display top banner when network is disconnected'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOfflineBanner(!offlineBanner)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                offlineBanner ? 'bg-[#22B84A]' : 'bg-black/20 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  offlineBanner ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Haptic Feedback */}
          <div className="p-3.5 rounded-[18px] bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-[12px] bg-purple-500/10 flex items-center justify-center shrink-0">
                <Vibrate className="w-4 h-4 text-[#7655E8]" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
                  {isBn ? 'হ্যাপটিক ভাইব্রেশন স্পর্শ' : 'Haptic Touch Feedback'}
                </span>
                <p className="text-[11px] text-[var(--hyper-text-secondary)] mt-0.5">
                  {isBn ? 'বাটন স্পর্শ ও কার্ড সরালে হালকা ভাইব্রেশন প্রতিক্রিয়া' : 'Subtle haptic vibration on mobile interaction'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHapticFeedback(!hapticFeedback)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                hapticFeedback ? 'bg-[#22B84A]' : 'bg-black/20 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  hapticFeedback ? 'translate-x-5' : 'translate-x-0.5'
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
          <span>{isBn ? 'ডিফল্ট মান' : 'Reset Defaults'}</span>
        </PillButton>
        <PillButton variant="primary" size="md" onClick={handleSave}>
          {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
        </PillButton>
      </div>
    </div>
  );
};
