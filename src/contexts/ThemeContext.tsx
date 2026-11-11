/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export type ThemePreference = 'light' | 'dark' | 'oled' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'oled';

interface ThemeContextType {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'anwar_property_theme_preference';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
    return saved === 'light' || saved === 'dark' || saved === 'oled' || saved === 'system' ? saved : 'light';
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (theme === 'system') return 'light'; // Default to light until full migration
    return theme;
  });

  // Synchronize DOM class and meta theme-color whenever theme or system preference changes
  useEffect(() => {
    function applyTheme() {
      const activeResolved: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme;
      setResolvedTheme(activeResolved);

      const root = document.documentElement;
      if (activeResolved === 'dark') {
        root.classList.add('dark');
        root.classList.remove('theme-oled');
        root.removeAttribute('data-theme');
        root.setAttribute('data-theme', 'dark');
        root.style.colorScheme = 'dark';
      } else if (activeResolved === 'oled') {
        root.classList.add('dark', 'theme-oled');
        root.setAttribute('data-theme', 'oled');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark', 'theme-oled');
        root.removeAttribute('data-theme');
        root.setAttribute('data-theme', 'light');
        root.style.colorScheme = 'light';
      }

      // Update mobile browser status bar color (Spec v3.1: Light #F2F3F5, Dark #0B0D10, OLED #000000)
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        const barColor = activeResolved === 'oled' ? '#000000' : activeResolved === 'dark' ? '#0B0D10' : '#F2F3F5';
        metaThemeColor.setAttribute('content', barColor);
      }

      // Synchronize native Capacitor Android status bar immediately
      if (Capacitor.isNativePlatform()) {
        if (activeResolved === 'dark' || activeResolved === 'oled') {
          const capColor = activeResolved === 'oled' ? '#000000' : '#0B0D10';
          StatusBar.setBackgroundColor({ color: capColor }).catch(() => {});
          StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        } else {
          StatusBar.setBackgroundColor({ color: '#F2F3F5' }).catch(() => {});
          StatusBar.setStyle({ style: Style.Light }).catch(() => {});
        }
      }
    }

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore storage write issues
    }
  };

  const toggleTheme = () => {
    if (resolvedTheme === 'light') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
