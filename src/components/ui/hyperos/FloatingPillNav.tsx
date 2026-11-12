import React, { useMemo } from 'react';
import { House, BookOpen, Files, ReceiptText, Wallet, UserRound } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { type NavItemConfig, DEFAULT_ANIMATION_SETTINGS } from '../../../types/settings';

export type MainNavSection = 'home' | 'accounts' | 'documents' | 'profile' | 'settings' | 'admin-control' | 'rent-deposit' | 'add-expense';

export interface FloatingPillNavProps {
  activeSection: MainNavSection;
  drillDownView: string | null;
  onSelectSection: (section: 'home' | 'accounts' | 'documents' | 'profile') => void;
  onOpenNewExpense: () => void;
  onOpenRentPayment: () => void;
  canCreateExpense?: boolean;
  canCollectRent?: boolean;
  className?: string;
}

/**
 * FloatingPillNav: Xiaomi HyperOS inspired floating frosted glass bottom navigation pill.
 * Supports customizable Navbar Animation Styles:
 * 1. Smooth Indicator – Active indicator slides smoothly between items.
 * 2. Scale – Active icon gently scales up.
 * 3. Slide – Active icon and label transition smoothly.
 */
export const FloatingPillNav: React.FC<FloatingPillNavProps> = ({
  activeSection,
  drillDownView,
  onSelectSection,
  onOpenNewExpense,
  onOpenRentPayment,
  canCreateExpense = true,
  canCollectRent = true,
  className = '',
}) => {
  const { t, currentLanguage } = useLanguage();
  const { settings } = useSettings();
  const configuredNavItems = settings?.navigation?.items;
  const navbarStyle = isMobile ? 'scale' : settings?.appearance?.navigationAnimation?.navbarAnimation || DEFAULT_ANIMATION_SETTINGS.navbarAnimation;
  const animSpeed = settings?.appearance?.navigationAnimation?.speed || DEFAULT_ANIMATION_SETTINGS.speed;

  const isMobile = useMediaQuery({ maxWidth: 768 });
const isBn = currentLanguage === 'bn';
  const isHomeActive = activeSection === 'home' && !drillDownView;
  // Accounts stays highlighted while one of its financial module tabs is open,
  // because tabs are navigation entries inside the accounts dashboard.
  const isAccountsActive = activeSection === 'accounts';
  const isDocumentsActive = activeSection === 'documents' && !drillDownView;
  const isProfileActive = (activeSection === 'profile' || activeSection === 'admin-control') && !drillDownView;
  const isNewExpenseActive = activeSection === 'add-expense' && !drillDownView;
  const isRentDepositActive = activeSection === 'rent-deposit' && !drillDownView;

  // Default item list if not configured
  const defaultItems: NavItemConfig[] = [
    { id: 'home', labelBn: 'হোম', labelEn: 'Home', visible: true, order: 1 },
    { id: 'accounts', labelBn: 'হিসাব', labelEn: 'Accounts', visible: true, order: 2 },
    { id: 'documents', labelBn: 'ডকুমেন্ট', labelEn: 'Documents', visible: true, order: 3 },
    { id: 'newExpense', labelBn: 'নতুন খরচ', labelEn: 'New Expense', visible: true, order: 4, isActionShortcut: true },
    { id: 'rentDeposit', labelBn: 'ভাড়া জমা', labelEn: 'Collect Rent', visible: true, order: 5, isActionShortcut: true },
    { id: 'profile', labelBn: 'প্রোফাইল', labelEn: 'Profile', visible: true, order: 6 },
  ];

  const itemsToRender = (configuredNavItems || defaultItems)
    .filter((item) => item.visible)
    .sort((a, b) => a.order - b.order);

  // Fallback: Ensure at least profile remains visible to prevent lockouts
  const finalItems = itemsToRender.length > 0
    ? itemsToRender
    : defaultItems.filter((i) => i.id === 'profile' || i.id === 'home');

  // Compute active item index & color for smooth indicator
  const { activeIndex, activeColor } = useMemo(() => {
    if (isHomeActive) {
      return {
        activeIndex: finalItems.findIndex((i) => i.id === 'home'),
        activeColor: '#22B84A',
      };
    }
    if (isAccountsActive) {
      return {
        activeIndex: finalItems.findIndex((i) => i.id === 'accounts'),
        activeColor: '#1685E8',
      };
    }
    if (isDocumentsActive) {
      return {
        activeIndex: finalItems.findIndex((i) => i.id === 'documents'),
        activeColor: '#1685E8',
      };
    }
    if (isNewExpenseActive) {
      return {
        activeIndex: finalItems.findIndex((i) => i.id === 'newExpense'),
        activeColor: '#F28A24',
      };
    }
    if (isRentDepositActive) {
      return {
        activeIndex: finalItems.findIndex((i) => i.id === 'rentDeposit'),
        activeColor: '#22B84A',
      };
    }
    if (isProfileActive) {
      return {
        activeIndex: finalItems.findIndex((i) => i.id === 'profile'),
        activeColor: '#7655E8',
      };
    }
    return { activeIndex: -1, activeColor: '#22B84A' };
  }, [finalItems, isHomeActive, isAccountsActive, isDocumentsActive, isNewExpenseActive, isRentDepositActive, isProfileActive]);

  const speedClass = useMemo(() => {
    switch (animSpeed) {
      case 'slow':
        return 'hyper-speed-slow';
      case 'fast':
        return 'hyper-speed-fast';
      case 'normal':
      default:
        return 'hyper-speed-normal';
    }
  }, [animSpeed]);

  const getItemClass = (isActive: boolean, activeBgClass: string, isAction = false) => {
    if (!isActive) {
      return `hyper-nav-item text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-[var(--surface-hover)] relative z-10 ${
        isAction ? 'border border-[var(--border-subtle)] bg-[var(--surface-card-subtle)]' : ''
      }`;
    }
    if (navbarStyle === 'smooth-indicator') {
      return 'hyper-nav-item text-white font-bold relative z-10 transition-colors duration-200';
    }
    if (navbarStyle === 'scale') {
      return `hyper-nav-item ${activeBgClass} text-white font-bold relative z-10`;
    }
    // 'slide' style
    return `hyper-nav-item ${activeBgClass} text-white font-bold relative z-10`;
  };

  const renderNavItem = (item: NavItemConfig) => {
    switch (item.id) {
      case 'home':
        return (
          <button
            key="home"
            type="button"
            data-nav-item="home"
            aria-label={t('navigation.ariaHome')}
            aria-current={isHomeActive ? 'page' : undefined}
            onClick={() => onSelectSection('home')}
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-full select-none cursor-pointer group min-w-0 ${getItemClass(
              isHomeActive,
              'bg-[var(--color-primary-fill)]'
            )}`}
          >
            <House
              className="w-5 h-5 shrink-0 group-active:scale-90"
              strokeWidth={isHomeActive ? 2.4 : 2}
              aria-hidden="true"
            />
            <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight mt-0.5 truncate max-w-full font-medium">
              {isBn ? item.labelBn : item.labelEn}
            </span>
          </button>
        );

      case 'accounts':
        return (
          <button
            key="accounts"
            type="button"
            data-nav-item="accounts"
            aria-label={t('navigation.ariaAccounts')}
            aria-current={isAccountsActive ? 'page' : undefined}
            onClick={() => onSelectSection('accounts')}
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-full select-none cursor-pointer group min-w-0 ${getItemClass(
              isAccountsActive,
              'bg-[var(--color-primary-fill)]'
            )}`}
          >
            <BookOpen
              className="w-5 h-5 shrink-0 group-active:scale-90"
              strokeWidth={isAccountsActive ? 2.4 : 2}
              aria-hidden="true"
            />
            <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight mt-0.5 truncate max-w-full font-medium">
              {isBn ? item.labelBn : item.labelEn}
            </span>
          </button>
        );

      case 'documents':
        return (
          <button
            key="documents"
            type="button"
            data-nav-item="documents"
            aria-label={isBn ? 'ডকুমেন্ট' : 'Documents'}
            aria-current={isDocumentsActive ? 'page' : undefined}
            onClick={() => onSelectSection('documents')}
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-full select-none cursor-pointer group min-w-0 ${getItemClass(
              isDocumentsActive,
              'bg-[var(--color-primary-fill)]'
            )}`}
          >
            <Files
              className="w-5 h-5 shrink-0 group-active:scale-90"
              strokeWidth={isDocumentsActive ? 2.4 : 2}
              aria-hidden="true"
            />
            <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight mt-0.5 truncate max-w-full font-medium">
              {isBn ? item.labelBn : item.labelEn}
            </span>
          </button>
        );

      case 'newExpense':
        return (
          <button
            key="newExpense"
            type="button"
            data-nav-item="new-expense"
            aria-label={t('navigation.ariaNewExpense')}
            aria-current={isNewExpenseActive ? 'page' : undefined}
            title={canCreateExpense ? t('navigation.newExpenseTooltip') : t('navigation.newExpenseDenied')}
            disabled={!canCreateExpense}
            onClick={onOpenNewExpense}
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-full select-none cursor-pointer group min-w-0 disabled:opacity-40 disabled:cursor-not-allowed ${getItemClass(
              isNewExpenseActive,
              'bg-[var(--color-primary-fill)]',
              true
            )}`}
          >
            <div className="relative flex items-center justify-center">
              <ReceiptText
                className="w-5 h-5 shrink-0 group-active:scale-90"
                strokeWidth={isNewExpenseActive ? 2.4 : 2}
                aria-hidden="true"
              />
              {!isNewExpenseActive && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[var(--hyper-green)] rounded-full border border-white dark:border-[#1c1c1e]"
                  aria-hidden="true"
                />
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight mt-0.5 truncate max-w-full font-semibold">
              {isBn ? item.labelBn : item.labelEn}
            </span>
          </button>
        );

      case 'rentDeposit':
        return (
          <button
            key="rentDeposit"
            type="button"
            data-nav-item="rent-deposit"
            aria-label={t('navigation.ariaRentDeposit')}
            aria-current={isRentDepositActive ? 'page' : undefined}
            title={canCollectRent ? t('navigation.rentDepositTooltip') : t('navigation.rentDepositDenied')}
            disabled={!canCollectRent}
            onClick={onOpenRentPayment}
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-full select-none cursor-pointer group min-w-0 disabled:opacity-40 disabled:cursor-not-allowed ${getItemClass(
              isRentDepositActive,
              'bg-[var(--color-primary-fill)]',
              true
            )}`}
          >
            <div className="relative flex items-center justify-center">
              <Wallet
                className="w-5 h-5 shrink-0 group-active:scale-90"
                strokeWidth={isRentDepositActive ? 2.4 : 2}
                aria-hidden="true"
              />
              {!isRentDepositActive && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#22B84A] rounded-full border border-white dark:border-[#1c1c1e]"
                  aria-hidden="true"
                />
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight mt-0.5 truncate max-w-full font-semibold">
              {isBn ? item.labelBn : item.labelEn}
            </span>
          </button>
        );

      case 'profile':
        return (
          <button
            key="profile"
            type="button"
            data-nav-item="profile"
            aria-label={t('navigation.ariaProfile')}
            aria-current={isProfileActive ? 'page' : undefined}
            onClick={() => onSelectSection('profile')}
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-full select-none cursor-pointer group min-w-0 ${getItemClass(
              isProfileActive,
              'bg-[var(--color-primary-fill)]'
            )}`}
          >
            <UserRound
              className="w-5 h-5 shrink-0 group-active:scale-90"
              strokeWidth={isProfileActive ? 2.4 : 2}
              aria-hidden="true"
            />
            <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight mt-0.5 truncate max-w-full font-medium">
              {isBn ? item.labelBn : item.labelEn}
            </span>
          </button>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`fixed bottom-3 sm:bottom-5 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 w-[calc(100%-1rem)] sm:w-[480px] md:w-[520px] z-50 pointer-events-auto pb-[env(safe-area-inset-bottom)] ${speedClass} ${className}`}
      data-testid="hyperos-floating-pill-nav"
      data-navbar-style={navbarStyle}
    >
      <nav
        aria-label={t('navigation.mainNavAria')}
        className={`relative rounded-[var(--radius-section)] border border-[var(--border-subtle)] bg-[var(--surface-card)] [box-shadow:var(--shadow-md)] p-1 grid items-center gap-1 transition-colors duration-200 ${
          navbarStyle === 'slide' ? 'overflow-visible' : 'overflow-hidden'
        }`}
        style={{
          gridTemplateColumns: `repeat(${finalItems.length}, minmax(0, 1fr))`,
        }}
      >
        {/* Smooth Sliding Pill Indicator (Style 1) */}
        {navbarStyle === 'smooth-indicator' && activeIndex >= 0 && (
          <div
            className="hyper-navbar-indicator-pill shadow-md"
            style={{
              width: `calc(${100 / finalItems.length}% - 4px)`,
              left: '2px',
              transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 4}px))`,
              backgroundColor: activeColor,
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-hidden="true"
          />
        )}

        {finalItems.map(renderNavItem)}
      </nav>
    </div>
  );
};

export default FloatingPillNav;
