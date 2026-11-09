import { useEffect, useState } from 'react';

interface AppOpeningSplashProps {
  onFinish: () => void;
  minDuration?: number; // Minimum display time in ms (default 2100)
}

export default function AppOpeningSplash({ onFinish, minDuration = 2200 }: AppOpeningSplashProps) {
  // Animation phases:
  // 0: Initial mount / dark-light ambient fade-in
  // 1: Outline wireframe emerges (0 - 600ms)
  // 2: Blue 'A' and Red swoosh ignite with color (600 - 1200ms)
  // 3: Full official branding reveals with shimmer sweep (1200 - 2000ms)
  // 4: Smooth exit zoom-fade out (2000 - 2400ms)
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Stage 1: Wireframe outline emerges immediately
    const t1 = setTimeout(() => setPhase(1), 80);

    // Stage 2: Color fill starts on 'A' and swoosh
    const t2 = setTimeout(() => setPhase(2), 650);

    // Stage 3: Full color reveal + shimmer
    const t3 = setTimeout(() => setPhase(3), 1200);

    // Stage 4: Trigger exit transition
    const t4 = setTimeout(() => {
      setPhase(4);
      setExiting(true);
    }, minDuration);

    // Finish and unmount
    const t5 = setTimeout(() => {
      onFinish();
    }, minDuration + 420);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [minDuration, onFinish]);

  // Allow instant skip on user tap
  const handleSkip = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onFinish, 200);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden cursor-pointer transition-all duration-400 ease-out ${
        exiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      } bg-white dark:bg-[#111215]`}
      style={{
        // Respect mobile safe areas
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Ambient Radial Aura Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        {/* Soft glowing ambient orbs */}
        <div
          className={`absolute w-[450px] h-[450px] sm:w-[600px] sm:h-[600px] rounded-full blur-3xl transition-opacity duration-1000 ${
            phase >= 1 ? 'opacity-35 dark:opacity-20' : 'opacity-0'
          } bg-gradient-to-tr from-blue-400/30 via-sky-300/20 to-emerald-300/30`}
        />
        <div
          className={`absolute w-[320px] h-[320px] rounded-full blur-2xl transition-opacity duration-700 ${
            phase >= 2 ? 'opacity-40 dark:opacity-25' : 'opacity-0'
          } bg-gradient-to-br from-red-400/20 via-amber-300/15 to-transparent`}
        />
      </div>

      {/* Main Logo Container */}
      <div className="relative w-[280px] sm:w-[360px] aspect-[1000/600] flex items-center justify-center">
        {/* Stage 1: Outline / Wireframe Layer */}
        <img
          src="/brand/splash-stage1-outline.png"
          alt=""
          className={`absolute inset-0 w-full h-full object-contain transition-all duration-700 ${
            phase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          } ${phase >= 3 ? 'opacity-0' : ''}`}
          style={{
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.06))',
            willChange: 'transform, opacity',
          }}
        />

        {/* Stage 2: Color Ignite Layer (Blue 'A' & Red swoosh) */}
        <img
          src="/brand/splash-stage2-accent.png"
          alt=""
          className={`absolute inset-0 w-full h-full object-contain transition-all duration-700 ${
            phase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          } ${phase >= 3 ? 'opacity-0' : ''}`}
          style={{
            filter: 'drop-shadow(0 6px 20px rgba(22, 133, 232, 0.25))',
            willChange: 'transform, opacity',
          }}
        />

        {/* Stage 3: Full Vibrant Brand Logo Layer */}
        <div
          className={`absolute inset-0 w-full h-full transition-all duration-600 ${
            phase >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
          style={{ willChange: 'transform, opacity' }}
        >
          <img
            src="/brand/splash-stage3-full.png"
            alt="Anwar Bhuiyan Property"
            className="w-full h-full object-contain"
            style={{
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.10))',
            }}
          />

          {/* Shimmer / Gloss Light Sweep Overlay (YouTube / Apple Style) */}
          <div
            className={`absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-500 ${
              phase >= 3 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div
              className={`w-full h-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent -skew-x-25 ${
                phase >= 3 ? 'animate-shimmer-sweep' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Brand Bengali Tagline & Loading Micro-Bar */}
      <div
        className={`mt-6 flex flex-col items-center transition-all duration-700 ${
          phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <p className="text-xs sm:text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-300">
          পারিবারিক ডিজিটাল প্রপার্টি ও আর্থিক খাতা
        </p>
        <p className="text-[10px] tracking-wider uppercase text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
          Anwar Bhuiyan Property Manager
        </p>

        {/* YouTube-Style Gradient Micro Progress Bar */}
        <div className="w-36 h-[2.5px] bg-slate-100 dark:bg-slate-800 rounded-full mt-4 overflow-hidden relative">
          <div
            className={`h-full bg-gradient-to-r from-[#1685E8] via-[#22B84A] to-[#F59E0B] rounded-full transition-all ease-out ${
              phase === 0
                ? 'w-0'
                : phase === 1
                ? 'w-1/4 duration-500'
                : phase === 2
                ? 'w-2/3 duration-600'
                : 'w-full duration-700'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
