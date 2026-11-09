import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  RotateCcw,
  Zap,
  Gauge,
  Sliders,
  Check,
  Eye,
  RefreshCw,
  Play,
  Compass,
  Shield,
  House,
  BookOpen,
  UserRound,
} from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { PillButton } from '../ui/hyperos/PillButton';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import type {
  PageTransitionStyle,
  AnimationSpeed,
  NavbarAnimationStyle,
  NavigationAnimationSettings as NavAnimSettingsType,
} from '../../types/settings';
import { DEFAULT_ANIMATION_SETTINGS } from '../../types/settings';

export interface NavigationAnimationSettingsProps {
  onBack?: () => void;
  className?: string;
}

interface TransitionCardDef {
  id: PageTransitionStyle;
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  subtitleEn: string;
  badge?: string;
  icon: typeof Layers;
}

const TRANSITION_STYLES: TransitionCardDef[] = [
  {
    id: 'default',
    titleBn: 'ডিফল্ট – ফেড ও স্লাইড',
    titleEn: 'Default – Fade + Slide',
    subtitleBn: 'মসৃণ হরিজন্টাল স্লাইড ও ফেড মোশন',
    subtitleEn: 'Smooth horizontal slide & gentle fade',
    badge: 'প্রস্তাবিত / Recommended',
    icon: Sparkles,
  },
  {
    id: 'roll',
    titleBn: 'রোল – থ্রিডি সিলিন্ডার মোশন',
    titleEn: 'Roll – Rolling 3D Transition',
    subtitleBn: 'সিলিন্ড্রিক্যাল অক্ষ বরাবর মসৃণ রোটেশন',
    subtitleEn: '3D cylindrical roll around vertical axis',
    icon: RotateCcw,
  },
  {
    id: 'cube',
    titleBn: 'কিউব – থ্রিডি কিউব ঘূর্ণন',
    titleEn: 'Cube – 3D Cube Rotation',
    subtitleBn: 'আধুনিক ফ্ল্যাগশিপ ৩ডি কিউব ফেস ট্রানজিশন',
    subtitleEn: 'High-end 3D cube rotation with depth',
    badge: 'HyperOS 3D',
    icon: Layers,
  },
  {
    id: 'flip',
    titleBn: 'ফ্লিপ – থ্রিডি পৃষ্ঠা ফ্লিপ',
    titleEn: 'Flip – 3D Page Flip',
    subtitleBn: 'বইয়ের পাতার মতো ৩ডি ফ্লিপ ও ডেপথ শ্যাডো',
    subtitleEn: 'Book page flip motion with realistic spine',
    icon: Sliders,
  },
  {
    id: 'card',
    titleBn: 'কার্ড – লেয়ার্ড কার্ড ট্রানজিশন',
    titleEn: 'Card – Layered Card Motion',
    subtitleBn: 'নিচ থেকে স্তরীভূত কার্ডের মতো সফট বাউন্স',
    subtitleEn: 'Bottom-up layered card deck with spring',
    icon: Zap,
  },
];

export const NavigationAnimationSettings: React.FC<NavigationAnimationSettingsProps> = ({
  onBack,
  className = '',
}) => {
  const { settings, updateSettings } = useSettings();
  const { currentLanguage } = useLanguage();
  const isBn = currentLanguage === 'bn';

  const storedSettings: NavAnimSettingsType =
    settings.appearance.navigationAnimation || DEFAULT_ANIMATION_SETTINGS;

  const [selectedStyle, setSelectedStyle] = useState<PageTransitionStyle>(
    storedSettings.pageTransition || 'default'
  );
  const [selectedSpeed, setSelectedSpeed] = useState<AnimationSpeed>(
    storedSettings.speed || 'normal'
  );
  const [selectedNavbar, setSelectedNavbar] = useState<NavbarAnimationStyle>(
    storedSettings.navbarAnimation || 'smooth-indicator'
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(
    Boolean(storedSettings.reducedMotion)
  );

  // Live preview simulator states
  const [previewScreen, setPreviewScreen] = useState<'screenA' | 'screenB'>('screenA');
  const [previewDirection, setPreviewDirection] = useState<'forward' | 'backward'>('forward');
  const [previewNonce, setPreviewNonce] = useState<number>(0);
  const [cardReplayId, setCardReplayId] = useState<PageTransitionStyle | null>(null);
  const [cardReplayNonce, setCardReplayNonce] = useState<number>(0);
  const [liveDockActive, setLiveDockActive] = useState<'home' | 'accounts' | 'profile'>('home');

  // Detect system prefers-reduced-motion
  const [systemReducedMotion, setSystemReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e: MediaQueryListEvent) => setSystemReducedMotion(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  function handleSave() {
    updateSettings({
      appearance: {
        ...settings.appearance,
        navigationAnimation: {
          pageTransition: selectedStyle,
          speed: selectedSpeed,
          navbarAnimation: selectedNavbar,
          reducedMotion,
        },
      },
    });
  }

  function handleReset() {
    setSelectedStyle(DEFAULT_ANIMATION_SETTINGS.pageTransition);
    setSelectedSpeed(DEFAULT_ANIMATION_SETTINGS.speed);
    setSelectedNavbar(DEFAULT_ANIMATION_SETTINGS.navbarAnimation);
    setReducedMotion(DEFAULT_ANIMATION_SETTINGS.reducedMotion);
  }

  function triggerLivePreview() {
    const nextDir = previewScreen === 'screenA' ? 'forward' : 'backward';
    const nextScreen = previewScreen === 'screenA' ? 'screenB' : 'screenA';
    setPreviewDirection(nextDir);
    setPreviewScreen(nextScreen);
    setPreviewNonce((n) => n + 1);
  }

  function replaySpecificCard(styleId: PageTransitionStyle, e: React.MouseEvent) {
    e.stopPropagation();
    setCardReplayId(styleId);
    setCardReplayNonce((n) => n + 1);
    setTimeout(() => {
      setCardReplayId(null);
    }, 600);
  }

  const speedMs = selectedSpeed === 'slow' ? 450 : selectedSpeed === 'fast' ? 180 : 300;

  return (
    <div className={`space-y-6 ${className}`} data-testid="navigation-animation-settings-center">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'নেভিগেশন ও অ্যানিমেশন' : 'Navigation & Animation'}
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#22B84A]/15 text-[#22B84A] dark:text-[#2dd35b] border border-[#22B84A]/30">
              HyperOS Motion
            </span>
          </div>
          <p className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn
              ? 'গ্লোবাল পেজ ট্রানজিশন স্টাইল, স্পিড ও বটম বার অ্যানিমেশন'
              : 'Customize 3D page transitions, speed curves, and bottom nav animations'}
          </p>
        </div>
        {onBack && (
          <PillButton variant="ghost" size="sm" onClick={onBack}>
            ← {isBn ? 'ফিরে যান' : 'Back'}
          </PillButton>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 1. INTERACTIVE LIVE PREVIEW SIMULATOR (PHONE MOCKUP)                  */}
      {/* ===================================================================== */}
      <HyperCard
        variant="default"
        className="p-4 sm:p-5 border border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)]/90 backdrop-blur-xl relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--hyper-border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--hyper-text-primary)]">
                {isBn ? 'লাইভ প্রিভিউ সিমুলেটর' : 'Interactive Live Preview Simulator'}
              </div>
              <div className="text-[11px] text-[var(--hyper-text-secondary)]">
                {isBn
                  ? `নির্বাচিত স্টাইল: ${TRANSITION_STYLES.find((s) => s.id === selectedStyle)?.titleBn} (${speedMs}ms)`
                  : `Active Style: ${selectedStyle.toUpperCase()} (${speedMs}ms)`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerLivePreview}
              className="px-3.5 py-1.5 rounded-full bg-[#22B84A] hover:bg-[#1faa43] active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer select-none"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isBn ? 'অ্যানিমেশন টেস্ট (Play)' : 'Test Transition'}</span>
            </button>
          </div>
        </div>

        {/* Live Simulator Viewport */}
        <div className="pt-4 flex flex-col items-center">
          <div className="w-full max-w-[340px] rounded-[24px] border-2 border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-base)] shadow-lg overflow-hidden flex flex-col [height:240px] relative">
            {/* Mock Status Bar */}
            <div className="px-4 py-1.5 flex items-center justify-between text-[10px] text-[var(--hyper-text-secondary)] border-b border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)]/80">
              <span className="font-semibold">9:41</span>
              <div className="flex items-center gap-1">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* Mock Screen Content with selected Page Transition Animation */}
            <div
              className={`flex-1 p-3 overflow-hidden relative hyper-page-transition-viewport hyper-speed-${selectedSpeed} ${
                reducedMotion ? 'hyper-reduced-motion' : ''
              }`}
            >
              <div
                key={`preview-${previewNonce}`}
                className={`w-full h-full rounded-2xl p-3 flex flex-col justify-between hyper-page-transition-content ${
                  reducedMotion
                    ? 'hyper-fade-only'
                    : `hyper-trans-${selectedStyle}-${previewDirection}`
                }`}
                style={{
                  backgroundColor: previewScreen === 'screenA' ? '#22B84A10' : '#1685E810',
                  border: `1px solid ${previewScreen === 'screenA' ? '#22B84A40' : '#1685E840'}`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{
                        backgroundColor: previewScreen === 'screenA' ? '#22B84A' : '#1685E8',
                      }}
                    >
                      {previewScreen === 'screenA' ? (isBn ? 'হোম ড্যাশবোর্ড' : 'Home Dashboard') : (isBn ? 'হিসাব খাতা' : 'Accounts Khata')}
                    </span>
                    <span className="text-[10px] text-[var(--hyper-text-secondary)] font-mono">
                      {previewDirection === 'forward' ? 'Forward →' : '← Backward'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[var(--hyper-text-primary)]">
                    {previewScreen === 'screenA'
                      ? (isBn ? 'মোট ভাড়া আদায়: ৳ ৪৫,০০০' : 'Total Rent: ৳ 45,000')
                      : (isBn ? 'মোট খরচ: ৳ ১২,৪০০' : 'Total Expenses: ৳ 12,400')}
                  </div>
                  <p className="text-[10px] text-[var(--hyper-text-secondary)] mt-1">
                    {isBn ? 'সঠিক রিয়েল-টাইম ট্রানজিশন ডিরেকশন প্রাকদর্শন' : 'Live directional simulation view'}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[var(--hyper-text-secondary)] pt-2 border-t border-black/5 dark:border-white/5">
                  <span>{isBn ? 'গতি:' : 'Speed:'} {speedMs}ms</span>
                  <span>{isBn ? 'স্টাইল:' : 'Style:'} {selectedStyle}</span>
                </div>
              </div>
            </div>

            {/* Mock Bottom Navbar showing selected Navbar Animation Style */}
            <div className="p-1.5 border-t border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)] flex items-center justify-around relative">
              {/* Smooth Indicator Pill for Mock */}
              {selectedNavbar === 'smooth-indicator' && (
                <div
                  className="absolute top-1.5 bottom-1.5 rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: '30%',
                    left: previewScreen === 'screenA' ? '3%' : '35%',
                    backgroundColor: previewScreen === 'screenA' ? '#22B84A' : '#1685E8',
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => {
                  setPreviewDirection('backward');
                  setPreviewScreen('screenA');
                  setPreviewNonce((n) => n + 1);
                }}
                className={`relative z-10 py-1 px-3 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${
                  previewScreen === 'screenA'
                    ? selectedNavbar === 'smooth-indicator'
                      ? 'text-white'
                      : selectedNavbar === 'scale'
                      ? 'bg-[#22B84A] text-white scale-110 shadow-xs'
                      : 'bg-[#22B84A] text-white -translate-y-1.5 shadow-md'
                    : 'text-[var(--hyper-text-secondary)]'
                }`}
              >
                <House className="w-3 h-3" />
                <span>{isBn ? 'হোম' : 'Home'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewDirection('forward');
                  setPreviewScreen('screenB');
                  setPreviewNonce((n) => n + 1);
                }}
                className={`relative z-10 py-1 px-3 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${
                  previewScreen === 'screenB'
                    ? selectedNavbar === 'smooth-indicator'
                      ? 'text-white'
                      : selectedNavbar === 'scale'
                      ? 'bg-[#1685E8] text-white scale-110 shadow-xs'
                      : 'bg-[#1685E8] text-white -translate-y-1.5 shadow-md'
                    : 'text-[var(--hyper-text-secondary)]'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>{isBn ? 'হিসাব' : 'Accounts'}</span>
              </button>

              <div className="text-[10px] text-[var(--hyper-text-secondary)] flex items-center gap-1 py-1 px-2 opacity-50">
                <UserRound className="w-3 h-3" />
                <span>{isBn ? 'প্রোফাইল' : 'Profile'}</span>
              </div>
            </div>
          </div>
        </div>
      </HyperCard>

      {/* ===================================================================== */}
      {/* 2. SECTION A: PAGE TRANSITION STYLE (5 OPTIONS)                       */}
      {/* ===================================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-[var(--hyper-text-primary)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22B84A]" />
            <span>{isBn ? 'ক. পেজ ট্রানজিশন স্টাইল' : 'A. Page Transition Style'}</span>
          </h4>
          <span className="text-xs text-[var(--hyper-text-secondary)]">
            {isBn ? '৫টি প্রিমিয়াম অপশন' : '5 Selectable Styles'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TRANSITION_STYLES.map((style) => {
            const isSelected = selectedStyle === style.id;
            const Icon = style.icon;
            const isReplayingThisCard = cardReplayId === style.id;

            return (
              <div
                key={style.id}
                role="button"
                tabIndex={0}
                data-transition-style-option={style.id}
                onClick={() => {
                  setSelectedStyle(style.id);
                  setPreviewDirection('forward');
                  setPreviewNonce((n) => n + 1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedStyle(style.id);
                    setPreviewNonce((n) => n + 1);
                  }
                }}
                className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none relative group overflow-hidden ${
                  isSelected
                    ? 'border-[#22B84A] bg-[#22B84A]/[0.08] shadow-sm'
                    : 'border-[var(--hyper-border-subtle)] bg-[var(--hyper-surface)] hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
                }`}
              >
                {/* Background Glass Accent for Selected */}
                {isSelected && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#22B84A]/10 rounded-full blur-2xl pointer-events-none" />
                )}

                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                        isSelected
                          ? 'bg-[#22B84A] text-white shadow-xs'
                          : 'bg-black/5 dark:bg-white/10 text-[var(--hyper-text-primary)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
                          {isBn ? style.titleBn : style.titleEn}
                        </span>
                        {style.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#22B84A]/20 text-[#22B84A] dark:text-[#2dd35b]">
                            {style.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--hyper-text-secondary)] mt-0.5">
                        {isBn ? style.subtitleBn : style.subtitleEn}
                      </p>
                    </div>
                  </div>

                  {/* Radio Indicator */}
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? 'border-[#22B84A] bg-[#22B84A] text-white'
                        : 'border-[var(--hyper-border-subtle)] bg-transparent'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {/* Mini Preview Box with Replay Button */}
                <div className="mt-3 pt-2.5 border-t border-[var(--hyper-border-subtle)] flex items-center justify-between">
                  {/* Miniature Motion Indicator */}
                  <div className="flex items-center gap-2 overflow-hidden py-1">
                    <div
                      className={`w-14 h-7 rounded-lg border border-[var(--hyper-border-subtle)] bg-black/5 dark:bg-white/5 flex items-center justify-center text-[10px] font-mono text-[var(--hyper-text-secondary)] relative overflow-hidden`}
                    >
                      <div
                        key={isReplayingThisCard ? `replay-${cardReplayNonce}` : `norm-${style.id}`}
                        className={`w-10 h-5 rounded bg-[#22B84A]/20 border border-[#22B84A]/40 ${
                          isReplayingThisCard || isSelected ? `hyper-trans-${style.id}-forward` : ''
                        }`}
                        style={{ animationDuration: '300ms' }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--hyper-text-secondary)] font-medium">
                      {isBn ? 'লাইভ মোশন প্রিভিউ' : 'Live motion preview'}
                    </span>
                  </div>

                  {/* Replay Button */}
                  <button
                    type="button"
                    onClick={(e) => replaySpecificCard(style.id, e)}
                    title={isBn ? 'অ্যানিমেশন পুনরায় দেখুন' : 'Replay Animation'}
                    className="p-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] transition-colors cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isReplayingThisCard ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. SECTION B: ANIMATION SPEED (3 OPTIONS)                             */}
      {/* ===================================================================== */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--hyper-border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
                {isBn ? 'খ. অ্যানিমেশন গতি (Speed)' : 'B. Animation Speed'}
              </h4>
              <p className="text-xs text-[var(--hyper-text-secondary)]">
                {isBn
                  ? 'প্রাকৃতিক মোশনের জন্য অপ্টিমাইজড টাইমিং কার্ভ'
                  : 'Natural easing curves and duration presets'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Slow */}
          <button
            type="button"
            data-speed-option="slow"
            onClick={() => setSelectedSpeed('slow')}
            className={`p-3 rounded-2xl border flex flex-col items-center text-center transition-all cursor-pointer ${
              selectedSpeed === 'slow'
                ? 'border-[#22B84A] bg-[#22B84A]/10 text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'border-transparent bg-black/5 dark:bg-white/5 text-[var(--hyper-text-secondary)]'
            }`}
          >
            <span className="text-xs font-bold">{isBn ? 'ধীর (Slow)' : 'Slow'}</span>
            <span className="text-[10px] text-[var(--hyper-text-secondary)] mt-0.5">450ms</span>
            <span className="text-[9px] opacity-75 mt-1 font-normal">
              {isBn ? 'মসৃণ ও স্পষ্ট' : 'Deliberate'}
            </span>
          </button>

          {/* Normal */}
          <button
            type="button"
            data-speed-option="normal"
            onClick={() => setSelectedSpeed('normal')}
            className={`p-3 rounded-2xl border flex flex-col items-center text-center transition-all cursor-pointer ${
              selectedSpeed === 'normal'
                ? 'border-[#22B84A] bg-[#22B84A]/10 text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'border-transparent bg-black/5 dark:bg-white/5 text-[var(--hyper-text-secondary)]'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold">{isBn ? 'স্বাভাবিক' : 'Normal'}</span>
              <span className="text-[8px] font-bold px-1 rounded bg-[#22B84A] text-white">Default</span>
            </div>
            <span className="text-[10px] text-[var(--hyper-text-secondary)] mt-0.5">300ms</span>
            <span className="text-[9px] opacity-75 mt-1 font-normal">
              {isBn ? 'প্রাকৃতিক ব্যালেন্স' : 'Balanced'}
            </span>
          </button>

          {/* Fast */}
          <button
            type="button"
            data-speed-option="fast"
            onClick={() => setSelectedSpeed('fast')}
            className={`p-3 rounded-2xl border flex flex-col items-center text-center transition-all cursor-pointer ${
              selectedSpeed === 'fast'
                ? 'border-[#22B84A] bg-[#22B84A]/10 text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'border-transparent bg-black/5 dark:bg-white/5 text-[var(--hyper-text-secondary)]'
            }`}
          >
            <span className="text-xs font-bold">{isBn ? 'দ্রুত (Fast)' : 'Fast'}</span>
            <span className="text-[10px] text-[var(--hyper-text-secondary)] mt-0.5">180ms</span>
            <span className="text-[9px] opacity-75 mt-1 font-normal">
              {isBn ? 'তাত্ক্ষণিক ও ক্ষিপ্র' : 'Snappy'}
            </span>
          </button>
        </div>
      </HyperCard>

      {/* ===================================================================== */}
      {/* 4. SECTION C: NAVBAR ANIMATION (3 STYLES)                             */}
      {/* ===================================================================== */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--hyper-border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-[#1685E8] flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--hyper-text-primary)]">
                {isBn ? 'গ. ন্যাভবার অ্যানিমেশন স্টাইল' : 'C. Navbar Animation Style'}
              </h4>
              <p className="text-xs text-[var(--hyper-text-secondary)]">
                {isBn
                  ? 'বটম ফ্লোটিং ডকের সক্রিয় উপাদান ট্রানজিশন'
                  : 'Floating dock active indicator transition effects'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Style 1: Smooth Indicator */}
          <button
            type="button"
            data-navbar-style-option="smooth-indicator"
            onClick={() => {
              setSelectedNavbar('smooth-indicator');
              updateSettings({
                appearance: {
                  ...settings.appearance,
                  navigationAnimation: {
                    ...(settings.appearance.navigationAnimation || DEFAULT_ANIMATION_SETTINGS),
                    navbarAnimation: 'smooth-indicator',
                  },
                },
              });
            }}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedNavbar === 'smooth-indicator'
                ? 'border-[#22B84A] bg-[#22B84A]/10 text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'border-transparent bg-black/5 dark:bg-white/5 text-[var(--hyper-text-secondary)]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">{isBn ? 'মসৃণ ইন্ডিকেটর' : 'Smooth Indicator'}</span>
                <span className="text-[8px] font-bold px-1 rounded bg-[#22B84A] text-white">Default</span>
              </div>
              <p className="text-[10px] text-[var(--hyper-text-secondary)] mt-1 leading-relaxed">
                {isBn ? 'সক্রিয় পিল ইন্ডিকেটরটি আইটেমসমূহের মধ্যে মসৃণভাবে স্লাইড করে' : 'Active indicator glides smoothly horizontally between tabs'}
              </p>
            </div>
            <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 mt-3 relative overflow-hidden">
              <div className="w-1/3 h-full rounded-full bg-[#22B84A]" />
            </div>
          </button>

          {/* Style 2: Scale */}
          <button
            type="button"
            data-navbar-style-option="scale"
            onClick={() => {
              setSelectedNavbar('scale');
              updateSettings({
                appearance: {
                  ...settings.appearance,
                  navigationAnimation: {
                    ...(settings.appearance.navigationAnimation || DEFAULT_ANIMATION_SETTINGS),
                    navbarAnimation: 'scale',
                  },
                },
              });
            }}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedNavbar === 'scale'
                ? 'border-[#22B84A] bg-[#22B84A]/10 text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'border-transparent bg-black/5 dark:bg-white/5 text-[var(--hyper-text-secondary)]'
            }`}
          >
            <div>
              <span className="text-xs font-bold">{isBn ? 'আইকন স্কেলিং' : 'Icon Scale'}</span>
              <p className="text-[10px] text-[var(--hyper-text-secondary)] mt-1 leading-relaxed">
                {isBn ? 'সক্রিয় আইকন হালকা বড় ও স্প্রিং ইফেক্ট সহ ফেড হয়' : 'Active tab icon scales up gently with tactile spring bounce'}
              </p>
            </div>
            <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 mt-3 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-[#22B84A] scale-125" />
            </div>
          </button>

          {/* Style 3: Slide */}
          <button
            type="button"
            data-navbar-style-option="slide"
            onClick={() => {
              setSelectedNavbar('slide');
              updateSettings({
                appearance: {
                  ...settings.appearance,
                  navigationAnimation: {
                    ...(settings.appearance.navigationAnimation || DEFAULT_ANIMATION_SETTINGS),
                    navbarAnimation: 'slide',
                  },
                },
              });
            }}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              selectedNavbar === 'slide'
                ? 'border-[#22B84A] bg-[#22B84A]/10 text-[var(--hyper-text-primary)] font-bold shadow-xs'
                : 'border-transparent bg-black/5 dark:bg-white/5 text-[var(--hyper-text-secondary)]'
            }`}
          >
            <div>
              <span className="text-xs font-bold">{isBn ? 'আইকন ও লেবেল স্লাইড' : 'Icon & Label Slide'}</span>
              <p className="text-[10px] text-[var(--hyper-text-secondary)] mt-1 leading-relaxed">
                {isBn ? 'আইকন ও টেক্সট উল্লম্বভাবে ওপর-নিচে স্মুথ ট্রানজিশন করে' : 'Active icon and label slide upward smoothly into focus'}
              </p>
            </div>
            <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 mt-3 flex items-center justify-center">
              <div className="w-4 h-1.5 rounded-full bg-[#22B84A] -translate-y-1" />
            </div>
          </button>
        </div>


        {/* Interactive Live Navbar Animation Test Dock */}
        <div className="pt-4 mt-2 border-t border-[var(--hyper-border-subtle)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--hyper-text-primary)]">
              {isBn ? 'ন্যাভবার অ্যানিমেশন লাইভ টেস্ট ডক' : 'Live Interactive Navbar Test Dock'}
            </span>
            <span className="text-[10px] text-[var(--hyper-text-secondary)]">
              {isBn ? 'ট্যাব ক্লিক করে ট্রানজিশন পরীক্ষা করুন' : 'Click tabs to verify real animation'}
            </span>
          </div>

          <div className={`p-3 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center hyper-speed-${selectedSpeed}`}>
            <div
              className={`w-full max-w-sm rounded-full border border-[var(--hyper-border-glass)] [box-shadow:var(--hyper-inner-highlight),var(--hyper-shadow-nav)] p-1.5 grid grid-cols-3 gap-1 relative ${
                selectedNavbar === 'slide' ? 'overflow-visible' : 'overflow-hidden'
              }`}
              data-testid="navbar-live-test-dock"
              data-navbar-style={selectedNavbar}
            >
              {/* Smooth Indicator Pill for Test Dock */}
              {selectedNavbar === 'smooth-indicator' && (
                <div
                  className="hyper-navbar-indicator-pill shadow-md"
                  style={{
                    width: 'calc(33.333% - 4px)',
                    left: '2px',
                    transform: `translateX(calc(${
                      liveDockActive === 'home' ? 0 : liveDockActive === 'accounts' ? 100 : 200
                    }% + ${
                      liveDockActive === 'home' ? 0 : liveDockActive === 'accounts' ? 4 : 8
                    }px))`,
                    backgroundColor:
                      liveDockActive === 'home'
                        ? '#22B84A'
                        : liveDockActive === 'accounts'
                        ? '#1685E8'
                        : '#7655E8',
                  }}
                  aria-hidden="true"
                />
              )}

              {/* Home */}
              <button
                type="button"
                data-test-dock-item="home"
                onClick={() => setLiveDockActive('home')}
                className={`py-2 px-1 rounded-full select-none cursor-pointer flex flex-col items-center justify-center min-w-0 ${
                  liveDockActive === 'home'
                    ? selectedNavbar === 'smooth-indicator'
                      ? 'hyper-nav-item text-white font-bold relative z-10'
                      : selectedNavbar === 'scale'
                      ? 'hyper-nav-item bg-[#22B84A] text-white shadow-md font-bold hyper-nav-scale-active relative z-10'
                      : 'hyper-nav-item bg-[#22B84A] text-white font-bold hyper-nav-slide-active relative z-10'
                    : 'hyper-nav-item hyper-nav-inactive text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 relative z-10'
                }`}
              >
                <House className="w-4 h-4 shrink-0" strokeWidth={liveDockActive === 'home' ? 2.4 : 2} />
                <span className="text-[10px] mt-0.5 truncate font-medium">
                  {isBn ? 'হোম' : 'Home'}
                </span>
              </button>

              {/* Accounts */}
              <button
                type="button"
                data-test-dock-item="accounts"
                onClick={() => setLiveDockActive('accounts')}
                className={`py-2 px-1 rounded-full select-none cursor-pointer flex flex-col items-center justify-center min-w-0 ${
                  liveDockActive === 'accounts'
                    ? selectedNavbar === 'smooth-indicator'
                      ? 'hyper-nav-item text-white font-bold relative z-10'
                      : selectedNavbar === 'scale'
                      ? 'hyper-nav-item bg-[#1685E8] text-white shadow-md font-bold hyper-nav-scale-active relative z-10'
                      : 'hyper-nav-item bg-[#1685E8] text-white font-bold hyper-nav-slide-active relative z-10'
                    : 'hyper-nav-item hyper-nav-inactive text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 relative z-10'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" strokeWidth={liveDockActive === 'accounts' ? 2.4 : 2} />
                <span className="text-[10px] mt-0.5 truncate font-medium">
                  {isBn ? 'হিসাব' : 'Accounts'}
                </span>
              </button>

              {/* Profile */}
              <button
                type="button"
                data-test-dock-item="profile"
                onClick={() => setLiveDockActive('profile')}
                className={`py-2 px-1 rounded-full select-none cursor-pointer flex flex-col items-center justify-center min-w-0 ${
                  liveDockActive === 'profile'
                    ? selectedNavbar === 'smooth-indicator'
                      ? 'hyper-nav-item text-white font-bold relative z-10'
                      : selectedNavbar === 'scale'
                      ? 'hyper-nav-item bg-[#7655E8] text-white shadow-md font-bold hyper-nav-scale-active relative z-10'
                      : 'hyper-nav-item bg-[#7655E8] text-white font-bold hyper-nav-slide-active relative z-10'
                    : 'hyper-nav-item hyper-nav-inactive text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 relative z-10'
                }`}
              >
                <UserRound className="w-4 h-4 shrink-0" strokeWidth={liveDockActive === 'profile' ? 2.4 : 2} />
                <span className="text-[10px] mt-0.5 truncate font-medium">
                  {isBn ? 'প্রোফাইল' : 'Profile'}
                </span>
              </button>
            </div>
          </div>
        </div>

      </HyperCard>

      {/* ===================================================================== */}
      {/* 5. SECTION D: REDUCED MOTION & ACCESSIBILITY                          */}
      {/* ===================================================================== */}
      <HyperCard variant="default" className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-500/15 text-[var(--hyper-text-primary)] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--hyper-text-primary)]">
                {isBn ? 'মোশন হ্রাস ও অ্যাক্সেসিবিলিটি (Reduced Motion)' : 'Reduced Motion & Accessibility'}
              </div>
              <div className="text-[11px] text-[var(--hyper-text-secondary)]">
                {isBn
                  ? '৩ডি রোটেশন ও লার্জ স্লাইড বাদ দিয়ে সাধারণ ফেড মোড চালু করুন'
                  : 'Disable 3D transforms & rotations; use gentle opacity fade'}
              </div>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#22B84A]" />
          </label>
        </div>

        {systemReducedMotion && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isBn
                ? 'আপনার ডিভাইসের অপারেটিং সিস্টেমে "Reduced Motion" সক্রিয় রয়েছে।'
                : 'System-level "prefers-reduced-motion" preference is currently detected.'}
            </span>
          </div>
        )}
      </HyperCard>

      {/* ===================================================================== */}
      {/* 6. ACTION FOOTER: RESET DEFAULTS & SAVE                               */}
      {/* ===================================================================== */}
      <div className="flex items-center justify-between pt-2">
        <PillButton variant="secondary" size="sm" onClick={handleReset} className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isBn ? 'ডিফল্ট পুনরুদ্ধার' : 'Reset to Default'}</span>
        </PillButton>
        <PillButton
          variant="primary"
          size="md"
          data-testid="save-anim-settings"
          data-save-nav-settings="true"
          onClick={handleSave}
        >
          {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
        </PillButton>
      </div>
    </div>
  );
};

export default NavigationAnimationSettings;
