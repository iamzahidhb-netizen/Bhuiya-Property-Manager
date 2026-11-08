import React, { createContext, useContext, useEffect, useState, useCallback, useTransition } from 'react';
import i18n, { type SupportedLanguage, defaultLanguage } from '../lib/i18n';
import { useAuth } from './AuthContext';

export interface LanguageContextType {
  currentLanguage: SupportedLanguage;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  isBengali: boolean;
  t: typeof i18n.t;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'abp_language_guest';
const UID_STORAGE_PREFIX = 'abp_language_';

function getStorageSafe(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageSafe(key: string, val: string): void {
  try {
    localStorage.setItem(key, val);
  } catch {
    // Safe fallback if storage blocked
  }
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [, startTransition] = useTransition();

  // Helper to resolve language
  const resolveCurrentLanguage = useCallback((): SupportedLanguage => {
    if (user && user.uid) {
      const savedUserLang = getStorageSafe(`${UID_STORAGE_PREFIX}${user.uid}`);
      if (savedUserLang === 'en' || savedUserLang === 'bn') {
        return savedUserLang;
      }
      // Inherit guest language or default
      const guestLang = getStorageSafe(GUEST_STORAGE_KEY);
      const inherited: SupportedLanguage = (guestLang === 'en' || guestLang === 'bn') ? guestLang : defaultLanguage;
      setStorageSafe(`${UID_STORAGE_PREFIX}${user.uid}`, inherited);
      return inherited;
    }

    // Guest mode
    const guestLang = getStorageSafe(GUEST_STORAGE_KEY);
    if (guestLang === 'en' || guestLang === 'bn') {
      return guestLang;
    }
    return defaultLanguage;
  }, [user]);

  // Track user UID to adjust state during render when user changes
  const [prevUid, setPrevUid] = useState<string | undefined>(user?.uid);
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const initial = resolveCurrentLanguage();
    if (i18n.language !== initial) {
      i18n.changeLanguage(initial);
    }
    return initial;
  });

  // Adjust state during render when user identity changes (React 19 pattern)
  if (user?.uid !== prevUid) {
    setPrevUid(user?.uid);
    const targetLang = resolveCurrentLanguage();
    setLanguageState(targetLang);
    i18n.changeLanguage(targetLang);
  }

  // Apply document title and HTML lang attributes
  const applyDocMetadata = useCallback((lang: SupportedLanguage) => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = 'ltr';
      document.title = lang === 'en' ? 'Anwar Bhuiyan Property' : 'আনোয়ার ভূঁইয়া প্রপার্টি';
    }
  }, []);

  // Synchronize document metadata on language change
  useEffect(() => {
    applyDocMetadata(language);
  }, [language, applyDocMetadata]);

  // Set Language Handler
  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    if (newLang !== 'en' && newLang !== 'bn') return;

    startTransition(() => {
      setLanguageState(newLang);
    });

    i18n.changeLanguage(newLang);
    applyDocMetadata(newLang);

    if (user && user.uid) {
      setStorageSafe(`${UID_STORAGE_PREFIX}${user.uid}`, newLang);
    } else {
      setStorageSafe(GUEST_STORAGE_KEY, newLang);
    }
  }, [user, applyDocMetadata]);

  // Toggle Language Handler
  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'bn' ? 'en' : 'bn');
  }, [language, setLanguage]);

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage: language,
        language,
        setLanguage,
        toggleLanguage,
        isBengali: language === 'bn',
        t: i18n.t.bind(i18n),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}