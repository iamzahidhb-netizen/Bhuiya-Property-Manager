import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bnTranslation from '../locales/bn/translation.json';
import enTranslation from '../locales/en/translation.json';

export const defaultLanguage = 'bn';
export const supportedLanguages = ['bn', 'en'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

// Determine initial language preference from localStorage guest key
const initialGuestLang = (() => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('abp_language_guest');
      if (saved === 'en' || saved === 'bn') return saved;
    } catch {
      // Safe fallback if localStorage is unavailable
    }
  }
  return defaultLanguage;
})();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      bn: { translation: bnTranslation },
      en: { translation: enTranslation },
    },
    lng: initialGuestLang,
    fallbackLng: defaultLanguage,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    returnNull: false,
    react: {
      useSuspense: false, // Avoid suspense issues during quick locale toggling
    },
  });

export default i18n;
