import React from 'react';
import { HyperCard } from '../ui/hyperos/HyperCard';
import { BackIconButton } from '../ui/hyperos/BackIconButton';
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
        </div>
        <BackIconButton onClick={onBack} aria-label={isBn ? 'ফিরে যান' : 'Back'} />
      </div>

      <HyperCard variant="default" className="p-6 text-center space-y-4 flex flex-col items-center">
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
        </div>

        <p className="text-sm text-[var(--hyper-text-secondary)] leading-relaxed">
          {isBn
            ? 'এই অ্যাপের ভাবনা, নকশা ও নির্মাণ—সবই করেছেন Zahid Hossain Bhuiyan।'
            : 'Conceived, designed, and built by Zahid Hossain Bhuiyan.'}
        </p>
        <div className="w-full pt-3 border-t border-[var(--hyper-border-subtle)] text-xs text-[var(--hyper-text-secondary)]">
          © {new Date().getFullYear()} {isBn ? 'আনোয়ার ভূঁইয়া প্রপার্টি' : 'Anwar Bhuiyan Property'} by Zahid&apos;s Verge
        </div>
      </HyperCard>
    </div>
  );
};
