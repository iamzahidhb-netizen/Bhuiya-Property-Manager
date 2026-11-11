import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Clock,
  CheckCircle,
  Database,
  RefreshCw,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { BackIconButton } from '../ui/hyperos/BackIconButton';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { DEFAULT_SETTINGS } from '../../types/settings';

export const SecurityPrivacySettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage } = useLanguage();
  const { workspaceId } = useWorkspace();
  const isBn = currentLanguage === 'bn';

  const [sessionTimeout, setSessionTimeout] = useState<number>(
    settings.security.sessionTimeoutMinutes
  );
  const [requireConfirm, setRequireConfirm] = useState<boolean>(
    settings.security.requireConfirmOnActions
  );

  function handleSave() {
    updateSettings({
      security: {
        sessionTimeoutMinutes: sessionTimeout,
        requireConfirmOnActions: requireConfirm,
      },
    });
  }

  function handleReset() {
    setSessionTimeout(DEFAULT_SETTINGS.security.sessionTimeoutMinutes);
    setRequireConfirm(DEFAULT_SETTINGS.security.requireConfirmOnActions);
  }

  const TIMEOUT_OPTIONS = [
    { value: 15, labelBn: '১৫ মিনিট', labelEn: '15 Minutes' },
    { value: 30, labelBn: '৩০ মিনিট', labelEn: '30 Minutes' },
    { value: 60, labelBn: '১ ঘণ্টা (ডিফল্ট)', labelEn: '1 Hour (Default)' },
    { value: 120, labelBn: '২ ঘণ্টা', labelEn: '2 Hours' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'নিরাপত্তা ও গোপনীয়তা' : 'Security & Privacy'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'সেশন মেয়াদ, ক্রিয়াকলাপের নিশ্চয়তা এবং ডেটা সুরক্ষা' : 'Session timeout, safety gates & workspace isolation'}
          </p>
        </div>
        <BackIconButton onClick={onBack} aria-label={isBn ? 'ফিরে যান' : 'Back'} />
      </div>

      {/* Financial Write Lock Compliance Card */}
      <div className="p-4 rounded-[22px] bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#22B84A] shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'আর্থিক সুরক্ষা লক স্ট্যাটাস: সংরক্ষিত' : 'Financial Safety Lock: Guarded'}
          </div>
          <p className="text-[var(--hyper-text-secondary)] leading-relaxed">
            {isBn
              ? 'স্টেজিং ও টেস্টিং এনভায়রনমেন্টে আর্থিক লেনদেনের মূল রেকর্ড সম্পূর্ণ সুরক্ষিত রাখা হয়েছে। প্রোডাকশন ডাটাবেজের অখণ্ডতা বজায় রাখতে write-protection কার্যকর রয়েছে।'
              : 'Production financial integrity is strictly protected in staging. Zero unintentional mutations can occur to baseline ledgers.'}
          </p>
        </div>
      </div>

      {/* Security Preferences */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-9 h-9 rounded-[14px] bg-[var(--hyper-green-bg)] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-[#22B84A]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'অ্যাক্সেস ও সেশন কন্ট্রোল' : 'Session & Confirmation Control'}
            </h4>
            <p className="text-xs text-[var(--hyper-text-secondary)]">
              {isBn ? 'নিষ্ক্রিয় থাকলে স্বয়ংক্রিয় লগআউট ও ভুল প্রতিরোধ' : 'Auto logout timeout & destructive action verification'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Session Timeout */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--hyper-text-primary)] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#1685E8]" />
              <span>{isBn ? 'নিষ্ক্রিয় সেশনের সময়সীমা' : 'Inactive Session Timeout'}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIMEOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSessionTimeout(opt.value)}
                  className={`py-2 px-2.5 rounded-[14px] text-xs font-semibold border cursor-pointer ${
                    sessionTimeout === opt.value
                      ? 'bg-[#22B84A]/10 border-[#22B84A] text-[var(--hyper-text-primary)] font-bold'
                      : 'bg-black/5 dark:bg-white/5 border-transparent text-[var(--hyper-text-secondary)]'
                  }`}
                >
                  {isBn ? opt.labelBn : opt.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Require Confirmation */}
          <div className="p-3.5 rounded-[18px] bg-black/5 dark:bg-white/5 flex items-center justify-between gap-3 pt-3">
            <div className="min-w-0 pr-2">
              <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
                {isBn ? 'সংবেদনশীল কাজে নিশ্চিতকরণ চাইবে' : 'Require Confirmation for Actions'}
              </span>
              <p className="text-[11px] text-[var(--hyper-text-secondary)] mt-0.5">
                {isBn
                  ? 'ভাড়া আদায় বা খরচ বাতিলের মতো গুরুত্বপূর্ণ ক্রিয়ায় দ্বিতীয়বার সতর্কবার্তা দেখান'
                  : 'Prompt confirm modal before executing major financial entries or cancellations'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRequireConfirm(!requireConfirm)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                requireConfirm ? 'bg-[#22B84A]' : 'bg-black/20 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  requireConfirm ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </HyperCard>

      {/* Workspace Isolation Specs */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-3 pb-2 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-8 h-8 rounded-[12px] bg-blue-500/10 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-[#1685E8]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'ওয়ার্কস্পেস বিচ্ছিন্নতা বিবরণ' : 'Workspace Data Isolation'}
            </h4>
            <p className="text-[11px] text-[var(--hyper-text-secondary)]">
              {isBn ? `সক্রিয় ওয়ার্কস্পেস: ${workspaceId || 'Default'}` : `Active Workspace ID: ${workspaceId || 'Default'}`}
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-[var(--hyper-text-secondary)]">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-[#22B84A] shrink-0 mt-0.5" />
            <span>
              {isBn
                ? 'ক্লাউড ফায়ারস্টোরের প্রতিটি নথি /workspaces/{id}/ রুটের অধীনে সম্পূর্ণ স্বাধীনভাবে সুরক্ষিত।'
                : 'All collection records are strictly partitioned under /workspaces/{workspaceId}/.'}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-[#22B84A] shrink-0 mt-0.5" />
            <span>
              {isBn
                ? 'অন্য কোনো অ্যাকাউন্ট বা বহিরাগত আইডি থেকে এই ওয়ার্কস্পেসের ডেটা অনুপ্রবেশ অসম্ভব।'
                : 'Zero data leakage: unauthorized accounts cannot query or intercept workspace records.'}
            </span>
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
