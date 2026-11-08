import React from 'react';
import { House, BookOpen, ReceiptText, Wallet, UserRound } from 'lucide-react';
import { LiquidGlass } from '../ui/LiquidGlass';
import { useLanguage } from '../../contexts/LanguageContext';

export interface LiquidGlassDockProps {
  activeSection: 'home' | 'accounts' | 'profile';
  drillDownView: string | null;
  onSelectSection: (section: 'home' | 'accounts' | 'profile') => void;
  onOpenNewExpense: () => void;
  onOpenRentPayment: () => void;
  canCreateExpense: boolean;
  canCollectRent: boolean;
}

export const LiquidGlassDock: React.FC<LiquidGlassDockProps> = ({
  activeSection,
  drillDownView,
  onSelectSection,
  onOpenNewExpense,
  onOpenRentPayment,
  canCreateExpense,
  canCollectRent,
}) => {
  const { t } = useLanguage();
  const isHomeActive = activeSection === 'home' && !drillDownView;
  const isAccountsActive = activeSection === 'accounts' && !drillDownView;
  const isProfileActive = activeSection === 'profile' && !drillDownView;

  return (
    <div
      className="fixed bottom-3 sm:bottom-6 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 w-[calc(100%-1rem)] sm:w-[500px] md:w-[540px] z-40 pointer-events-auto pb-[env(safe-area-inset-bottom)]"
      data-testid="liquid-glass-dock-container"
    >
      <LiquidGlass
        as="nav"
        aria-label={t('navigation.mainNavAria')}
        className="liquid-glass-dock-5 border border-white/80 shadow-2xl"
        scale={-85}
        chroma={4}
        blur={8}
        saturate={1.5}
        glare={false}
      >
        {/* 1. হোম (Home Dashboard) */}
        <button
          type="button"
          data-nav-item="home"
          aria-label={t('navigation.ariaHome')}
          aria-current={isHomeActive ? 'page' : undefined}
          onClick={() => onSelectSection('home')}
          className={`liquid-glass-dock-5-item ${isHomeActive ? 'active' : ''}`}
        >
          <House
            className="w-5 h-5 sm:w-5.5 sm:h-5.5 shrink-0 transition-transform duration-150"
            strokeWidth={isHomeActive ? 2.3 : 2}
            aria-hidden="true"
          />
          <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight whitespace-nowrap truncate max-w-full font-medium">
            {t('navigation.home')}
          </span>
        </button>

        {/* 2. হিসাব (Accounts Screen) */}
        <button
          type="button"
          data-nav-item="accounts"
          aria-label={t('navigation.ariaAccounts')}
          aria-current={isAccountsActive ? 'page' : undefined}
          onClick={() => onSelectSection('accounts')}
          className={`liquid-glass-dock-5-item ${isAccountsActive ? 'active' : ''}`}
        >
          <BookOpen
            className="w-5 h-5 sm:w-5.5 sm:h-5.5 shrink-0 transition-transform duration-150"
            strokeWidth={isAccountsActive ? 2.3 : 2}
            aria-hidden="true"
          />
          <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight whitespace-nowrap truncate max-w-full font-medium">
            {t('navigation.accounts')}
          </span>
        </button>

        {/* 3. নতুন খরচ (New Expense Modal Shortcut) */}
        <button
          type="button"
          data-nav-item="new-expense"
          aria-label={t('navigation.ariaNewExpense')}
          title={canCreateExpense ? t('navigation.newExpenseTooltip') : t('navigation.newExpenseDenied')}
          disabled={!canCreateExpense}
          onClick={onOpenNewExpense}
          className="liquid-glass-dock-5-item text-amber-700 hover:text-amber-800 hover:bg-amber-50/70 border-transparent hover:border-amber-200/50"
        >
          <div className="relative flex items-center justify-center">
            <ReceiptText
              className="w-5 h-5 sm:w-5.5 sm:h-5.5 shrink-0 text-amber-600 transition-transform duration-150"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white"
              aria-hidden="true"
            />
          </div>
          <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight whitespace-nowrap truncate max-w-full font-semibold text-amber-800">
            {t('navigation.newExpense')}
          </span>
        </button>

        {/* 4. ভাড়া জমা (Rent Deposit Modal Shortcut) */}
        <button
          type="button"
          data-nav-item="rent-deposit"
          aria-label={t('navigation.ariaRentDeposit')}
          title={canCollectRent ? t('navigation.rentDepositTooltip') : t('navigation.rentDepositDenied')}
          disabled={!canCollectRent}
          onClick={onOpenRentPayment}
          className="liquid-glass-dock-5-item text-teal-700 hover:text-teal-800 hover:bg-emerald-50/70 border-transparent hover:border-emerald-200/50"
        >
          <div className="relative flex items-center justify-center">
            <Wallet
              className="w-5 h-5 sm:w-5.5 sm:h-5.5 shrink-0 text-emerald-700 transition-transform duration-150"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white"
              aria-hidden="true"
            />
          </div>
          <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight whitespace-nowrap truncate max-w-full font-semibold text-emerald-800">
            {t('navigation.rentDeposit')}
          </span>
        </button>

        {/* 5. প্রোফাইল (Profile Screen) */}
        <button
          type="button"
          data-nav-item="profile"
          aria-label={t('navigation.ariaProfile')}
          aria-current={isProfileActive ? 'page' : undefined}
          onClick={() => onSelectSection('profile')}
          className={`liquid-glass-dock-5-item ${isProfileActive ? 'active' : ''}`}
        >
          <UserRound
            className="w-5 h-5 sm:w-5.5 sm:h-5.5 shrink-0 transition-transform duration-150"
            strokeWidth={isProfileActive ? 2.3 : 2}
            aria-hidden="true"
          />
          <span className="text-[10px] sm:text-[11px] leading-tight tracking-tight whitespace-nowrap truncate max-w-full font-medium">
            {t('navigation.profile')}
          </span>
        </button>
      </LiquidGlass>
    </div>
  );
};

export default LiquidGlassDock;
