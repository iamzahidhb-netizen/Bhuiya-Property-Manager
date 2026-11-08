/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { type AppSettings, DEFAULT_SETTINGS } from '../types/settings';
import { useWorkspace } from './WorkspaceContext';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetToDefaults: () => void;
  canEditSettings: boolean;
  isSavedNoticeVisible: boolean;
}

const SETTINGS_STORAGE_PREFIX = 'abp_workspace_settings_';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

/**
 * Validate and merge partial/saved settings against DEFAULT_SETTINGS allowlist
 */
function sanitizeSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_SETTINGS;
  }
  const s = raw as Partial<AppSettings>;

  return {
    languageRegion: {
      ...DEFAULT_SETTINGS.languageRegion,
      ...(s.languageRegion || {}),
    },
    appearance: {
      ...DEFAULT_SETTINGS.appearance,
      ...(s.appearance || {}),
    },
    dashboard: {
      sections: Array.isArray(s.dashboard?.sections)
        ? s.dashboard!.sections
        : DEFAULT_SETTINGS.dashboard.sections,
      financialCards: Array.isArray(s.dashboard?.financialCards)
        ? s.dashboard!.financialCards
        : DEFAULT_SETTINGS.dashboard.financialCards,
      quickActions: Array.isArray(s.dashboard?.quickActions)
        ? s.dashboard!.quickActions
        : DEFAULT_SETTINGS.dashboard.quickActions,
    },
    navigation: {
      items: Array.isArray(s.navigation?.items)
        ? s.navigation!.items
        : DEFAULT_SETTINGS.navigation.items,
    },
    modules: {
      items: Array.isArray(s.modules?.items)
        ? s.modules!.items
        : DEFAULT_SETTINGS.modules.items,
    },
    billing: {
      ...DEFAULT_SETTINGS.billing,
      ...(s.billing || {}),
    },
    expenseCategories: Array.isArray(s.expenseCategories)
      ? s.expenseCategories
      : DEFAULT_SETTINGS.expenseCategories,
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(s.notifications || {}),
    },
    security: {
      ...DEFAULT_SETTINGS.security,
      ...(s.security || {}),
    },
  };
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { workspaceId, isMasterAdmin } = useWorkspace();
  const { setLanguage } = useLanguage();
  const { setTheme } = useTheme();

  const storageKey = `${SETTINGS_STORAGE_PREFIX}${workspaceId || 'default'}`;

  const [settings, setSettingsState] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return sanitizeSettings(JSON.parse(stored));
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  const [isSavedNoticeVisible, setIsSavedNoticeVisible] = useState(false);

  // Sync settings when workspaceId changes
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          setSettingsState(sanitizeSettings(JSON.parse(stored)));
        } else {
          setSettingsState(DEFAULT_SETTINGS);
        }
      } catch {
        setSettingsState(DEFAULT_SETTINGS);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [storageKey]);

  // Sync Language and Theme when settings change
  useEffect(() => {
    if (settings.languageRegion?.language) {
      setLanguage(settings.languageRegion.language);
    }
    if (settings.appearance?.theme) {
      setTheme(settings.appearance.theme);
    }
  }, [settings.languageRegion?.language, settings.appearance?.theme, setLanguage, setTheme]);

  const updateSettings = useCallback(
    (newPartialSettings: Partial<AppSettings>) => {
      setSettingsState((prev) => {
        const merged: AppSettings = sanitizeSettings({
          ...prev,
          ...newPartialSettings,
          languageRegion: {
            ...prev.languageRegion,
            ...(newPartialSettings.languageRegion || {}),
          },
          appearance: {
            ...prev.appearance,
            ...(newPartialSettings.appearance || {}),
          },
          dashboard: {
            ...prev.dashboard,
            ...(newPartialSettings.dashboard || {}),
          },
          navigation: {
            ...prev.navigation,
            ...(newPartialSettings.navigation || {}),
          },
          modules: {
            ...prev.modules,
            ...(newPartialSettings.modules || {}),
          },
          billing: {
            ...prev.billing,
            ...(newPartialSettings.billing || {}),
          },
          notifications: {
            ...prev.notifications,
            ...(newPartialSettings.notifications || {}),
          },
          security: {
            ...prev.security,
            ...(newPartialSettings.security || {}),
          },
        });

        try {
          localStorage.setItem(storageKey, JSON.stringify(merged));
        } catch {
          // Ignore storage quota
        }

        setIsSavedNoticeVisible(true);
        setTimeout(() => setIsSavedNoticeVisible(false), 2000);

        return merged;
      });
    },
    [storageKey]
  );

  const resetToDefaults = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
    try {
      localStorage.setItem(storageKey, JSON.stringify(DEFAULT_SETTINGS));
    } catch {
      // Ignore
    }
    setIsSavedNoticeVisible(true);
    setTimeout(() => setIsSavedNoticeVisible(false), 2000);
  }, [storageKey]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetToDefaults,
        canEditSettings: Boolean(isMasterAdmin),
        isSavedNoticeVisible,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
