import React from 'react';
import { House, BookOpen, ReceiptText, Wallet, UserRound } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useSettings } from '../../../contexts/SettingsContext';
import type { NavItemConfig } from '../../../types/settings';

export interface FloatingPillNavProps {
  activeSection: 'home' | 'accounts' | 'profile' | 'settings';
  drillDownView: string | null;
  onSelectSection: (section: 'home' | 'accounts' | 'profile') => void;
  onOpenNewExpense: () => void;
  onOpenRentPayment: () => void;
  canCreateExpense?: boolean;
  canCollectRent?: boolean;
  className?: string;
}

/**
 * FloatingPillNav: Xiaomi HyperOS inspired floating frosted glass bottom navigation pill.
 * Fully integrates with centralized Settings Navigation Manager.
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
  let configuredNavItems: NavItemConfig[] | undefined;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { settings } = useSettings();
    configuredNavItems = settings?.navigation?.items;
  } catch {
    // Fallback if rendered outside SettingsProvider
  }

  const isBn = currentLanguage === 'bn';
  const isHomeActive = activeSection === 'home' && !drillDownView;
  const isAccountsActive = activeSection === 'accounts' && !drillDownView;
  const isProfileActive = activeSection === 'profile' && !drillDownView;

  // Default item list if not configured
  const defaultItems: NavItemConfig[] = [
    { id: 'home', labelBn: 'হোম', labelEn: 'Home', visible: true, order: 1 },
    { id: 'accounts', labelBn: 'হিসাব', labelEn: 'Accounts', visible: true, order: 2 },
    { id: 'newExpense', labelBn: 'নতুন খরচ', labelEn: 'New Expense', visible: true, order: 3, isActionShortcut: true },
    { id: 'rentDeposit', labelBn: 'ভাড়া জমা', labelEn: 'Collect Rent', visible: true, order: 4, isActionShortcut: true },
    { id: 'profile', labelBn: 'প্রোফাইল', labelEn: 'Profile', visible: true, order: 5 },
  ];

  const itemsToRender = (configuredNavItems || defaultItems)
    .filter((item) => item.visible)
    .sort((a, b) => a.order - b.order);

  // Fallback: Ensure at least profile remains visible to prevent lockouts
  const finalItems = itemsToRender.length > 0
    ? itemsToRender
    : defaultItems.filter((i) => i.id === 'profile' || i.id === 'home');

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
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-full transition-all duration-150 select-none cursor-pointer group min-w-0 ${
              isHomeActive
                ? 'bg-[#22B84A] text-white shadow-md shadow-[#22B84A]/30 font-bold'
                : 'text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95'
            }`}
          >
            <House
              className="w-5 h-5 shrink-0 transition-transform duration-150 group-active:scale-90"
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
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-full transition-all duration-150 select-none cursor-pointer group min-w-0 ${
              isAccountsActive
                ? 'bg-[#1685E8] text-white shadow-md shadow-[#1685E8]/30 font-bold'
                : 'text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95'
            }`}
          >
            <BookOpen
              className="w-5 h-5 shrink-0 transition-transform duration-150 group-active:scale-90"
              strokeWidth={isAccountsActive ? 2.4 : 2}
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
            title={canCreateExpense ? t('navigation.newExpenseTooltip') : t('navigation.newExpenseDenied')}
            disabled={!canCreateExpense}
            onClick={onOpenNewExpense}
            className="relative flex flex-col items-center justify-center py-2 px-1 rounded-full text-[#F28A24] hover:bg-[#F28A24]/10 active:scale-95 transition-all duration-150 select-none cursor-pointer group min-w-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="relative flex items-center justify-center">
              <ReceiptText
                className="w-5 h-5 shrink-0 transition-transform duration-150 group-active:scale-90"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#F28A24] rounded-full border border-white dark:border-[#1c1c1e]"
                aria-hidden="true"
              />
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
            title={canCollectRent ? t('navigation.rentDepositTooltip') : t('navigation.rentDepositDenied')}
            disabled={!canCollectRent}
            onClick={onOpenRentPayment}
            className="relative flex flex-col items-center justify-center py-2 px-1 rounded-full text-[#22B84A] hover:bg-[#22B84A]/10 active:scale-95 transition-all duration-150 select-none cursor-pointer group min-w-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="relative flex items-center justify-center">
              <Wallet
                className="w-5 h-5 shrink-0 transition-transform duration-150 group-active:scale-90"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#22B84A] rounded-full border border-white dark:border-[#1c1c1e]"
                aria-hidden="true"
              />
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
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-full transition-all duration-150 select-none cursor-pointer group min-w-0 ${
              isProfileActive
                ? 'bg-[#7655E8] text-white shadow-md shadow-[#7655E8]/30 font-bold'
                : 'text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95'
            }`}
          >
            <UserRound
              className="w-5 h-5 shrink-0 transition-transform duration-150 group-active:scale-90"
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
      className={`fixed bottom-3 sm:bottom-6 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 w-[calc(100%-1rem)] sm:w-[480px] md:w-[500px] z-40 pointer-events-auto pb-[env(safe-area-inset-bottom)] ${className}`}
      data-testid="hyperos-floating-pill-nav"
    >
      <nav
        aria-label={t('navigation.mainNavAria')}
        className="hyper-glass-nav relative rounded-full border border-[var(--hyper-border-glass)] [box-shadow:var(--hyper-inner-highlight),var(--hyper-shadow-nav)] p-1.5 grid items-center gap-1 transition-all duration-200"
        style={{
          gridTemplateColumns: `repeat(${finalItems.length}, minmax(0, 1fr))`,
        }}
      >
        {finalItems.map(renderNavItem)}
      </nav>
    </div>
  );
};

export default FloatingPillNav;
