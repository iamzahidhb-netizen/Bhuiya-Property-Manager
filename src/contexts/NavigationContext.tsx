/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import type { SettingsCategoryId } from '../components/settings/settingsCategoryDefinitions';

export type NavSection =
  | 'home'
  | 'accounts'
  | 'documents'
  | 'profile'
  | 'settings'
  | 'admin-control'
  | 'rent-deposit'
  | 'add-expense';

export type DrillDownView =
  | 'properties'
  | 'tenants'
  | 'rent'
  | 'expenses'
  | 'distribution'
  | 'reports'
  | null;

export type NavigationDirection = 'forward' | 'backward' | 'none';

export interface NavState {
  section: NavSection;
  drillDownView: DrillDownView;
  settingsCategory: SettingsCategoryId | null;
  preSelectedTenantId: string | null;
}

export interface BackGuard {
  id: string;
  isDirty: () => boolean;
  onBlocked: () => void;
}

interface HistoryPayload {
  app: 'anwar-bhuiyan-property';
  step: number;
  state: NavState;
}

export interface NavigationContextValue {
  navState: NavState;
  activeSection: NavSection;
  drillDownView: DrillDownView;
  settingsCategory: SettingsCategoryId | null;
  preSelectedTenantId: string | null;
  direction: NavigationDirection;
  pageKey: string;
  transitionNonce: number;

  navigateTo: (
    section: NavSection,
    options?: { preSelectedTenantId?: string | null; direction?: NavigationDirection }
  ) => void;
  setDrillDownView: (view: DrillDownView) => void;
  setSettingsCategory: (cat: SettingsCategoryId | null) => void;
  setPreSelectedTenantId: (id: string | null) => void;

  goBack: () => void;
  forceBack: () => void;
  registerBackGuard: (guard: BackGuard) => () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function computePageKey(state: NavState): string {
  if (state.section === 'settings') {
    return state.settingsCategory ? `settings-${state.settingsCategory}` : 'settings-home';
  }
  if (state.section === 'accounts') {
    return state.drillDownView ? `accounts-${state.drillDownView}` : 'accounts-home';
  }
  if (state.section === 'documents') return 'documents';
  if (state.drillDownView) {
    return `accounts-${state.drillDownView}`;
  }
  return state.section;
}

function computeHash(state: NavState): string {
  if (state.section === 'settings') {
    return state.settingsCategory ? `#/settings/${state.settingsCategory}` : '#/settings';
  }
  if (state.section === 'accounts') {
    return state.drillDownView ? `#/accounts/${state.drillDownView}` : '#/accounts';
  }
  if (state.section === 'documents') return '#/documents';
  if (state.drillDownView) {
    return `#/accounts/${state.drillDownView}`;
  }
  if (state.section === 'rent-deposit') return '#/rent-deposit';
  if (state.section === 'add-expense') return '#/add-expense';
  if (state.section === 'profile') return '#/profile';
  if (state.section === 'admin-control') return '#/admin';
  return '#/home';
}

export function parseStateFromHash(hash: string): NavState {
  if (hash.startsWith('#/settings')) {
    const parts = hash.split('/');
    const cat = parts[2] as SettingsCategoryId | undefined;
    return {
      section: 'settings',
      drillDownView: null,
      settingsCategory: cat || null,
      preSelectedTenantId: null,
    };
  }
  if (hash.startsWith('#/accounts')) {
    const parts = hash.split('/');
    const drill = parts[2] as DrillDownView | undefined;
    return {
      section: 'accounts',
      drillDownView: drill || null,
      settingsCategory: null,
      preSelectedTenantId: null,
    };
  }
  if (hash === '#/documents') {
    return {
      section: 'documents',
      drillDownView: null,
      settingsCategory: null,
      preSelectedTenantId: null,
    };
  }
  if (hash === '#/rent-deposit') {
    return {
      section: 'rent-deposit',
      drillDownView: null,
      settingsCategory: null,
      preSelectedTenantId: null,
    };
  }
  if (hash === '#/add-expense') {
    return {
      section: 'add-expense',
      drillDownView: null,
      settingsCategory: null,
      preSelectedTenantId: null,
    };
  }
  if (hash === '#/profile') {
    return {
      section: 'profile',
      drillDownView: null,
      settingsCategory: null,
      preSelectedTenantId: null,
    };
  }
  if (hash === '#/admin') {
    return {
      section: 'admin-control',
      drillDownView: null,
      settingsCategory: null,
      preSelectedTenantId: null,
    };
  }

  return {
    section: 'home',
    drillDownView: null,
    settingsCategory: null,
    preSelectedTenantId: null,
  };
}

function parseInitialStateFromUrl(): NavState {
  if (typeof window === 'undefined') {
    return {
      section: 'home',
      drillDownView: null,
      settingsCategory: null,
      preSelectedTenantId: null,
    };
  }

  const existingState = window.history.state as HistoryPayload | null;
  if (existingState && existingState.app === 'anwar-bhuiyan-property' && existingState.state) {
    return existingState.state;
  }

  return parseStateFromHash(window.location.hash);
}

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [navState, setNavState] = useState<NavState>(parseInitialStateFromUrl);
  const [direction, setDirection] = useState<NavigationDirection>('none');
  const [transitionNonce, setTransitionNonce] = useState<number>(0);

  const stepRef = useRef<number>(
    typeof window !== 'undefined' &&
      (window.history.state as HistoryPayload | null)?.app === 'anwar-bhuiyan-property'
      ? (window.history.state as HistoryPayload).step || 0
      : 0
  );
  const navStateRef = useRef<NavState>(navState);

  useEffect(() => {
    navStateRef.current = navState;
  }, [navState]);

  const pageKey = useMemo(() => computePageKey(navState), [navState]);

  const backGuardsRef = useRef<Map<string, BackGuard>>(new Map());
  const isBypassingGuardRef = useRef<boolean>(false);
  const isNavigatingRef = useRef<boolean>(false);

  // Central pushState dispatcher
  const pushNewState = useCallback(
    (nextState: NavState, forcedDirection?: NavigationDirection) => {
      const currentState = navStateRef.current;
      // Check if new state is identical to current state (prevents duplicate entries)
      if (
        currentState.section === nextState.section &&
        currentState.drillDownView === nextState.drillDownView &&
        currentState.settingsCategory === nextState.settingsCategory &&
        currentState.preSelectedTenantId === nextState.preSelectedTenantId
      ) {
        return;
      }

      const currentKey = computePageKey(currentState);
      const nextKey = computePageKey(nextState);
      const nextDirection: NavigationDirection =
        forcedDirection !== undefined
          ? forcedDirection
          : currentKey !== nextKey
          ? 'forward'
          : 'none';

      stepRef.current += 1;
      const payload: HistoryPayload = {
        app: 'anwar-bhuiyan-property',
        step: stepRef.current,
        state: nextState,
      };

      try {
        window.history.pushState(payload, '', computeHash(nextState));
      } catch (e) {
        console.warn('[Navigation] pushState warning:', e);
      }
      setDirection(nextDirection);
      setTransitionNonce((n) => n + 1);
      setNavState(nextState);
    },
    []
  );

  // Initialize browser history entry once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const existingState = window.history.state as HistoryPayload | null;
    const rootHome: NavState = {
      section: 'home',
      drillDownView: null,
      settingsCategory: null,
      preSelectedTenantId: null,
    };

    if (existingState && existingState.app === 'anwar-bhuiyan-property' && typeof existingState.step === 'number') {
      stepRef.current = Math.max(1, existingState.step);
    } else {
      const initialState = navStateRef.current;
      // ALWAYS place a root anchor entry at step 0 so Android back button never unexpectedly exits the site
      window.history.replaceState(
        { app: 'anwar-bhuiyan-property', step: 0, state: rootHome },
        '',
        '#/home'
      );

      if (
        initialState.section !== 'home' ||
        initialState.drillDownView !== null ||
        initialState.settingsCategory !== null
      ) {
        stepRef.current = 1;
        window.history.pushState(
          { app: 'anwar-bhuiyan-property', step: 1, state: initialState },
          '',
          computeHash(initialState)
        );
      } else {
        // Active Dashboard Home at step 1
        stepRef.current = 1;
        window.history.pushState(
          { app: 'anwar-bhuiyan-property', step: 1, state: rootHome },
          '',
          '#/home'
        );
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      // 1. Guard check for unsaved changes or active interceptors
      if (!isBypassingGuardRef.current) {
        for (const guard of backGuardsRef.current.values()) {
          if (guard.isDirty()) {
            // The browser popped back 1 step; push the current forward state back to keep URL & position
            const restoreEntry: HistoryPayload = {
              app: 'anwar-bhuiyan-property',
              step: stepRef.current,
              state: navStateRef.current,
            };
            window.history.pushState(
              restoreEntry,
              '',
              computeHash(navStateRef.current)
            );
            // Trigger the block handler (e.g. show confirm modal)
            guard.onBlocked();
            return;
          }
        }
      }

      // Reset bypass flag after checking
      isBypassingGuardRef.current = false;

      const payload = event.state as HistoryPayload | null;
      if (payload && payload.app === 'anwar-bhuiyan-property') {
        const nextStep = payload.step;
        const currentStep = stepRef.current;
        const nextKey = computePageKey(payload.state);
        const currentKey = computePageKey(navStateRef.current);

        // If nextStep is 0 (popped into the root anchor below Dashboard Home)
        if (nextStep === 0) {
          stepRef.current = 1;
          const homeState: NavState = {
            section: 'home',
            drillDownView: null,
            settingsCategory: null,
            preSelectedTenantId: null,
          };
          window.history.pushState(
            { app: 'anwar-bhuiyan-property', step: 1, state: homeState },
            '',
            '#/home'
          );
          setDirection('none');
          setNavState(homeState);
          return;
        }

        let nextDirection: NavigationDirection = 'none';
        if (nextKey !== currentKey) {
          nextDirection = nextStep < currentStep ? 'backward' : 'forward';
        }

        stepRef.current = nextStep;
        setDirection(nextDirection);
        setTransitionNonce((n) => n + 1);
        setNavState(payload.state);
      } else {
        // Same-document navigation without our payload (for example a deep
        // link pasted while the app is already open, or an Android intent).
        // Adopt the URL hash instead of discarding it and resetting to home.
        const deepLinkState = parseStateFromHash(window.location.hash || '');
        const deepLinkKey = computePageKey(deepLinkState);
        if (deepLinkKey !== 'home') {
          if (computePageKey(navStateRef.current) !== deepLinkKey) {
            stepRef.current += 1;
            setDirection('forward');
            setTransitionNonce((n) => n + 1);
            setNavState(deepLinkState);
          }
          window.history.replaceState(
            {
              app: 'anwar-bhuiyan-property',
              step: stepRef.current,
              state: deepLinkState,
            },
            '',
            computeHash(deepLinkState)
          );
          return;
        }

        // User popped past initial entry or entered from outside:
        // Return cleanly to Dashboard Home instead of exiting
        stepRef.current = 1;
        const fallbackHome: NavState = {
          section: 'home',
          drillDownView: null,
          settingsCategory: null,
          preSelectedTenantId: null,
        };
        setDirection('backward');
        setTransitionNonce((n) => n + 1);
        setNavState(fallbackHome);
        window.history.pushState(
          { app: 'anwar-bhuiyan-property', step: 1, state: fallbackHome },
          '',
          '#/home'
        );
      }
    };

    const handleHashChange = () => {
      const currentHash = window.location.hash;
      const expectedHash = computeHash(navStateRef.current);
      if (currentHash && currentHash !== expectedHash) {
        const parsedState = parseStateFromHash(currentHash);
        const currentKey = computePageKey(navStateRef.current);
        const nextKey = computePageKey(parsedState);
        if (currentKey !== nextKey) {
          pushNewState(parsedState);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [pushNewState]);

  const navigateTo = useCallback(
    (
      section: NavSection,
      options?: { preSelectedTenantId?: string | null; direction?: NavigationDirection }
    ) => {
      const next: NavState = {
        section,
        drillDownView: null,
        settingsCategory: null,
        preSelectedTenantId:
          options?.preSelectedTenantId !== undefined
            ? options.preSelectedTenantId
            : null,
      };
      pushNewState(next, options?.direction);
    },
    [pushNewState]
  );

  // Centralized goBack used by both in-app back buttons and external calls
  const goBack = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 200);

    // Check guards first
    for (const guard of backGuardsRef.current.values()) {
      if (guard.isDirty()) {
        guard.onBlocked();
        return;
      }
    }

    if (stepRef.current > 1) {
      window.history.back();
    } else {
      // If at step 1 or below, return to Dashboard Home if not already there
      if (
        navStateRef.current.section !== 'home' ||
        navStateRef.current.drillDownView !== null ||
        navStateRef.current.settingsCategory !== null
      ) {
        navigateTo('home', { direction: 'backward' });
      }
    }
  }, [navigateTo]);

  // Native Capacitor Android Hardware / Gesture Back Button handling
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isSubscribed = true;
    const backListenerPromise = CapacitorApp.addListener('backButton', () => {
      if (!isSubscribed) return;

      // 1. Guard check for active popups, open dropdowns, or unsaved forms
      for (const guard of backGuardsRef.current.values()) {
        if (guard.isDirty()) {
          guard.onBlocked();
          return;
        }
      }

      // 2. If at root dashboard home with no drill-down/settings open, minimize app gracefully
      const current = navStateRef.current;
      if (
        current.section === 'home' &&
        current.drillDownView === null &&
        current.settingsCategory === null
      ) {
        CapacitorApp.minimizeApp();
        return;
      }

      // 3. Navigate back through centralized goBack
      goBack();
    });

    return () => {
      isSubscribed = false;
      backListenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, [goBack]);

  const setDrillDownView = useCallback(
    (view: DrillDownView) => {
      if (view === null) {
        if (navStateRef.current.drillDownView !== null) {
          goBack();
          return;
        }
      }
      const next: NavState = {
        ...navStateRef.current,
        section: view ? 'accounts' : navStateRef.current.section,
        drillDownView: view,
      };
      pushNewState(next, view ? 'forward' : 'backward');
    },
    [pushNewState, goBack]
  );

  const setSettingsCategory = useCallback(
    (cat: SettingsCategoryId | null) => {
      if (cat === null) {
        if (navStateRef.current.settingsCategory !== null) {
          goBack();
          return;
        }
      }
      const next: NavState = {
        ...navStateRef.current,
        section: 'settings',
        settingsCategory: cat,
      };
      pushNewState(next, cat ? 'forward' : 'backward');
    },
    [pushNewState, goBack]
  );

  const setPreSelectedTenantId = useCallback((id: string | null) => {
    setNavState((prev) => ({ ...prev, preSelectedTenantId: id }));
  }, []);

  // Force back bypassing any dirty check (used when user clicks "Discard & Exit")
  const forceBack = useCallback(() => {
    isBypassingGuardRef.current = true;
    if (stepRef.current > 1) {
      window.history.back();
    } else {
      isBypassingGuardRef.current = false;
      navigateTo('home', { direction: 'backward' });
    }
  }, [navigateTo]);

  // Register an unsaved-changes or modal guard
  const registerBackGuard = useCallback((guard: BackGuard) => {
    backGuardsRef.current.set(guard.id, guard);
    return () => {
      backGuardsRef.current.delete(guard.id);
    };
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      navState,
      activeSection: navState.section,
      drillDownView: navState.drillDownView,
      settingsCategory: navState.settingsCategory,
      preSelectedTenantId: navState.preSelectedTenantId,
      direction,
      pageKey,
      transitionNonce,

      navigateTo,
      setDrillDownView,
      setSettingsCategory,
      setPreSelectedTenantId,

      goBack,
      forceBack,
      registerBackGuard,
    }),
    [
      navState,
      direction,
      pageKey,
      transitionNonce,
      navigateTo,
      setDrillDownView,
      setSettingsCategory,
      setPreSelectedTenantId,
      goBack,
      forceBack,
      registerBackGuard,
    ]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export function useAppNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useAppNavigation must be used within a NavigationProvider');
  }
  return ctx;
}
