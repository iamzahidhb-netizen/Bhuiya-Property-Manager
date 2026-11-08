import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type PillButtonVariant = 'primary' | 'secondary' | 'segmented' | 'danger' | 'ghost';

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillButtonVariant;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

/**
 * PillButton: Xiaomi HyperOS inspired capsule button.
 * Used for segmented tab switches, primary actions, and filters with 44px min touch target.
 */
export const PillButton: React.FC<PillButtonProps> = ({
  variant = 'primary',
  active = false,
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  children,
  className = '',
  disabled,
  ...rest
}) => {
  const sizeClasses = {
    sm: 'min-h-[36px] px-3.5 py-1.5 text-xs',
    md: 'min-h-[44px] px-5 py-2.5 text-sm',
    lg: 'min-h-[50px] px-6 py-3 text-base',
  }[size];

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#22B84A] to-[#1EA342] text-white shadow-md shadow-[#22B84A]/25 border border-white/20 hover:brightness-105 active:scale-[0.98]',
    secondary:
      'bg-[var(--hyper-bg-card)] text-[var(--hyper-text-primary)] border border-[var(--hyper-border)] hover:bg-[var(--hyper-bg-card-hover)] active:scale-[0.98] [box-shadow:var(--hyper-inner-highlight),var(--hyper-shadow-card)]',
    segmented: active
      ? 'bg-white dark:bg-[#323236] text-[var(--hyper-text-primary)] font-bold shadow-sm shadow-black/10 border border-black/5 dark:border-white/10'
      : 'bg-transparent text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] font-medium',
    danger:
      'bg-gradient-to-r from-[#E94B4B] to-[#D43838] text-white shadow-md shadow-[#E94B4B]/25 border border-white/20 hover:brightness-105 active:scale-[0.98]',
    ghost:
      'bg-transparent text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-black/5 dark:hover:bg-white/5',
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...rest}
    >
      {Icon && iconPosition === 'left' && (
        <Icon className="w-4 h-4 shrink-0" strokeWidth={2.2} />
      )}
      <span className="truncate">{children}</span>
      {Icon && iconPosition === 'right' && (
        <Icon className="w-4 h-4 shrink-0" strokeWidth={2.2} />
      )}
    </button>
  );
};

export default PillButton;
