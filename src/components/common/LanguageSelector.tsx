import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export interface LanguageSelectorProps {
  className?: string;
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className = '', compact = false }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-full bg-white/70 backdrop-blur-md border border-white/80 shadow-2xs text-xs font-semibold ${className}`}
      role="group"
      aria-label="Language selector"
      data-testid="language-selector"
    >
      <div className="flex items-center pl-1.5 pr-1 text-slate-500" aria-hidden="true">
        <Languages className={compact ? 'w-3.5 h-3.5 text-emerald-700' : 'w-4 h-4 text-emerald-700'} />
      </div>

      <button
        type="button"
        data-language="bn"
        data-lang-btn="bn"
        onClick={() => setLanguage('bn')}
        className={`px-2.5 py-1 rounded-full transition-all duration-150 cursor-pointer text-xs select-none ${
          language === 'bn'
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-2xs font-bold border border-white/30'
            : 'text-slate-600 hover:text-emerald-800 hover:bg-white/60 font-medium'
        }`}
        aria-pressed={language === 'bn'}
      >
        বাংলা
      </button>

      <span className="text-slate-300 text-xs select-none">|</span>

      <button
        type="button"
        data-language="en"
        data-lang-btn="en"
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-full transition-all duration-150 cursor-pointer text-xs select-none ${
          language === 'en'
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-2xs font-bold border border-white/30'
            : 'text-slate-600 hover:text-emerald-800 hover:bg-white/60 font-medium'
        }`}
        aria-pressed={language === 'en'}
      >
        English
      </button>
    </div>
  );
};

export default LanguageSelector;
