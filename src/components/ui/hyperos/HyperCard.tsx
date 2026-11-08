import React from 'react';

export interface HyperCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'floating' | 'flat';
  glass?: boolean;
  clickable?: boolean;
  className?: string;
}

/**
 * HyperCard: Xiaomi HyperOS inspired card container.
 * Features 28px radius, refined inner specular highlight, soft ambient shadow,
 * and semi-opaque light/dark surfaces with zero GPU layer stacking.
 */
export const HyperCard: React.FC<HyperCardProps> = ({
  children,
  variant = 'default',
  glass = false,
  clickable = false,
  className = '',
  onClick,
  ...rest
}) => {
  const isClickable = clickable || Boolean(onClick);
  const baseClasses = 'relative rounded-[28px] transition-all duration-200 overflow-hidden';

  const surfaceClasses = {
    default:
      'bg-[var(--hyper-bg-card)] border border-[var(--hyper-border)] shadow-[var(--hyper-shadow-card)] [box-shadow:var(--hyper-inner-highlight),var(--hyper-shadow-card)]',
    subtle:
      'bg-[var(--hyper-bg-card-subtle)] border border-[var(--hyper-border-subtle)]',
    floating:
      'bg-[var(--hyper-bg-glass-strong)] border border-[var(--hyper-border-glass)] shadow-[var(--hyper-shadow-nav)] [box-shadow:var(--hyper-inner-highlight),var(--hyper-shadow-nav)]',
    flat:
      'bg-[var(--hyper-bg-card)] border border-[var(--hyper-border-subtle)]',
  }[variant];

  const glassClasses = glass
    ? 'backdrop-blur-xl -webkit-backdrop-blur-xl'
    : '';

  const interactiveClasses = isClickable
    ? 'cursor-pointer hover:bg-[var(--hyper-bg-card-hover)] active:scale-[0.985] select-none'
    : '';

  return (
    <div
      className={`${baseClasses} ${surfaceClasses} ${glassClasses} ${interactiveClasses} ${className}`}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
};

export default HyperCard;
