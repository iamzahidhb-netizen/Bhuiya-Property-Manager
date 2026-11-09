import React from 'react';
import {
  ShieldCheck,
  Smartphone,
  Heart,
  Download,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useLanguage } from '../../contexts/LanguageContext';

export const AboutSupportSettings: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
            {isBn ? 'সম্পর্কে ও সহায়তা' : 'About & Support'}
          </h3>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? 'অ্যাপের বিবরণ, সংস্করণ ও অফিসিয়াল তথ্য' : 'Application details, version and support'}
          </p>
        </div>
        <PillButton variant="ghost" size="sm" onClick={onBack}>
          ← {isBn ? 'ফিরে যান' : 'Back'}
        </PillButton>
      </div>

      {/* Brand Hero Card */}
      <HyperCard variant="default" className="p-6 text-center space-y-4 flex flex-col items-center">
        {/* Official AB Logo */}
        <div className="w-20 h-20 rounded-[28px] bg-white dark:bg-[#252528] p-3 shadow-md border border-[var(--hyper-border-subtle)] flex items-center justify-center overflow-hidden">
          <img
            src="/brand/anwar-bhuiyan-property.svg"
            alt="Anwar Bhuiyan Property Logo"
            className="w-full h-full object-contain"
          />
        </div>

        <div>
          <h4 className="text-lg font-extrabold text-[var(--hyper-text-primary)]">
            {isBn ? 'আনোয়ার ভূঁইয়া প্রপার্টি' : 'Anwar Bhuiyan Property'}
          </h4>
          <p className="text-xs text-[var(--hyper-text-secondary)] mt-0.5">
            {isBn
              ? 'প্রিমিয়াম রিয়েল এস্টেট ও পারিবারিক সম্পত্তি ব্যবস্থাপনা সিস্টেম'
              : 'Premium Real Estate & Property Management System'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#22B84A]/10 text-[#22B84A] border border-[#22B84A]/30">
            v1.0.0-hyperos
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/10 text-[var(--hyper-text-secondary)]">
            Nov 9, 2026
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-black/5 dark:bg-white/10 text-[var(--hyper-text-secondary)]">
            Android APK
          </span>
        </div>

        <a
          href="/bhuiya-property-manager.apk"
          download="bhuiya-property-manager.apk"
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[18px] bg-gradient-to-r from-[#1685E8] to-[#22B84A] text-white text-xs font-bold shadow-md hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{isBn ? 'নতুন Android APK ডাউনলোড করুন' : 'Download Latest Android APK'}</span>
          <span className="text-[10px] opacity-85 font-mono">(~13 MB)</span>
        </a>
      </HyperCard>

      {/* Design System & Specifications */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-3 pb-2 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-8 h-8 rounded-[12px] bg-orange-500/10 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-[#F28A24]" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-[var(--hyper-text-primary)] uppercase tracking-wider">
              {isBn ? 'ডিজাইন স্থাপত্য ও প্রযুক্তি' : 'Architecture & Design System'}
            </h5>
            <p className="text-[11px] text-[var(--hyper-text-secondary)]">
              Xiaomi HyperOS Inspired Liquid Frosted Glass
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-[16px] bg-black/5 dark:bg-white/5 space-y-0.5">
            <span className="text-[10px] text-[var(--hyper-text-secondary)]">Frontend Engine</span>
            <div className="font-bold text-[var(--hyper-text-primary)]">React 19 + Vite</div>
          </div>
          <div className="p-3 rounded-[16px] bg-black/5 dark:bg-white/5 space-y-0.5">
            <span className="text-[10px] text-[var(--hyper-text-secondary)]">Style Engine</span>
            <div className="font-bold text-[var(--hyper-text-primary)]">Tailwind CSS v4</div>
          </div>
          <div className="p-3 rounded-[16px] bg-black/5 dark:bg-white/5 space-y-0.5">
            <span className="text-[10px] text-[var(--hyper-text-secondary)]">Database Layer</span>
            <div className="font-bold text-[var(--hyper-text-primary)]">Firebase Firestore</div>
          </div>
          <div className="p-3 rounded-[16px] bg-black/5 dark:bg-white/5 space-y-0.5">
            <span className="text-[10px] text-[var(--hyper-text-secondary)]">Edge Staging</span>
            <div className="font-bold text-[var(--hyper-text-primary)]">Cloudflare Pages</div>
          </div>
        </div>
      </HyperCard>

      {/* Support & Legal */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-3 pb-2 border-b border-[var(--hyper-border-subtle)]">
          <div className="w-8 h-8 rounded-[12px] bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#22B84A]" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-[var(--hyper-text-primary)] uppercase tracking-wider">
              {isBn ? 'সহায়তা ও যোগাযোগ' : 'Technical Support & Inquiries'}
            </h5>
            <p className="text-[11px] text-[var(--hyper-text-secondary)]">
              Anwar Bhuiyan Family Office
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-[var(--hyper-text-secondary)] leading-relaxed">
          <p>
            {isBn
              ? 'এই অ্যাপ্লিকেশনটি আনোয়ার ভূঁইয়া পরিবারের বাণিজ্যিক ও আবাসিক সম্পত্তির সুষ্ঠু পরিচালনা, ভাড়া আদায় এবং পারিবারিক বণ্টনের স্বচ্ছতা রক্ষার্থে নির্মিত।'
              : 'Designed and developed for the Anwar Bhuiyan Family Office for residential property management and transparent dividend distribution.'}
          </p>
          <div className="pt-2 flex items-center justify-between text-[11px] border-t border-[var(--hyper-border-subtle)]">
            <span>© 2026 Anwar Bhuiyan Property</span>
            <span className="flex items-center gap-1 text-[var(--hyper-text-primary)] font-semibold">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>Made for Family</span>
            </span>
          </div>
        </div>
      </HyperCard>
    </div>
  );
};
