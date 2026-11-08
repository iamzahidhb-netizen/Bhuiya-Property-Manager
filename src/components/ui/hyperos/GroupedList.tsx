import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { HyperCard } from './HyperCard';

export interface GroupedListItemProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  isLast?: boolean;
  className?: string;
}

export const GroupedListItem: React.FC<GroupedListItemProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconBg = 'bg-[var(--hyper-blue-bg)]',
  iconColor = 'text-[#1685E8]',
  trailing,
  showChevron = true,
  onClick,
  disabled = false,
  isLast = false,
  className = '',
}) => {
  const isClickable = Boolean(onClick) && !disabled;

  return (
    <div className="relative">
      <div
        onClick={isClickable ? onClick : undefined}
        className={`flex items-center justify-between p-3.5 sm:p-4 rounded-[20px] transition-colors duration-150 ${
          isClickable
            ? 'cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.05] active:bg-black/[0.06] dark:active:bg-white/[0.08]'
            : ''
        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
      >
        {/* Left: Optional squircle icon + Title/Subtitle */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {Icon && (
            <div
              className={`w-10 h-10 rounded-[14px] ${iconBg} flex items-center justify-center shrink-0`}
              aria-hidden="true"
            >
              <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2.2} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-[var(--hyper-text-primary)] leading-tight truncate">
              {title}
            </h4>
            {subtitle && (
              <p className="text-xs text-[var(--hyper-text-secondary)] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Trailing content + optional Chevron */}
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {trailing}
          {showChevron && isClickable && (
            <ChevronRight
              className="w-4 h-4 text-[var(--hyper-text-tertiary)]"
              strokeWidth={2.2}
            />
          )}
        </div>
      </div>

      {/* Inset Hairline Divider (indented past icon if present) */}
      {!isLast && (
        <div
          className={`h-[1px] bg-[var(--hyper-border-subtle)] ${
            Icon ? 'ml-16 mr-3' : 'mx-4'
          }`}
        />
      )}
    </div>
  );
};

export interface GroupedListProps {
  title?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * GroupedList: Xiaomi HyperOS inspired grouped list container (My Files & Phone Manager).
 * Groups list items inside a 28px card with inset hairline dividers.
 */
export const GroupedList: React.FC<GroupedListProps> = ({
  title,
  headerAction,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-2 pt-1">
          <h3 className="text-sm font-bold tracking-tight text-[var(--hyper-text-secondary)] uppercase">
            {title}
          </h3>
          {headerAction}
        </div>
      )}
      <HyperCard variant="default" className="p-1 sm:p-1.5">
        {children}
      </HyperCard>
    </div>
  );
};

export default GroupedList;
