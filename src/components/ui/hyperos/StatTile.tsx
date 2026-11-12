import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { HyperCard } from './HyperCard';

export type StatTileColor = 'green' | 'blue' | 'orange' | 'purple' | 'red';

export interface StatTileProps {
  label: string;
  amount: string;
  subtitle?: string;
  icon: LucideIcon;
  color?: StatTileColor;
  trend?: 'up' | 'down' | 'neutral';
  trendText?: string;
  onClick?: () => void;
  className?: string;
}

const colorMap: Record<StatTileColor, { badgeBg: string; iconColor: string; amountColor: string }> = {
  green: {
    badgeBg: 'bg-[var(--hyper-green-bg)]',
    iconColor: 'text-[var(--color-primary-ink)]',
    amountColor: 'text-[var(--color-primary-ink)]',
  },
  blue: {
    badgeBg: 'bg-[var(--hyper-blue-bg)]',
    iconColor: 'text-[var(--color-info-ink)]',
    amountColor: 'text-[var(--color-info-ink)]',
  },
  orange: {
    badgeBg: 'bg-[var(--hyper-orange-bg)]',
    iconColor: 'text-[var(--color-warning-ink)]',
    amountColor: 'text-[var(--color-warning-ink)]',
  },
  purple: {
    badgeBg: 'bg-[var(--hyper-purple-bg)]',
    iconColor: 'text-[var(--color-admin-ink)]',
    amountColor: 'text-[var(--color-admin-ink)]',
  },
  red: {
    badgeBg: 'bg-[var(--hyper-red-bg)]',
    iconColor: 'text-[var(--color-danger-ink)]',
    amountColor: 'text-[var(--color-danger-ink)]',
  },
};

/**
 * StatTile: High-contrast financial summary card with Xiaomi squircle badge.
 * Designed for Home Dashboard financial metrics with tabular numerals and safe Bengali wrapping.
 */
export const StatTile: React.FC<StatTileProps> = ({
  label,
  amount,
  subtitle,
  icon: Icon,
  color = 'green',
  trend,
  trendText,
  onClick,
  className = '',
}) => {
  const { badgeBg, iconColor, amountColor } = colorMap[color];

  return (
    <HyperCard
      clickable={Boolean(onClick)}
      onClick={onClick}
      className={`p-4 sm:p-5 flex flex-col justify-between ${className}`}
    >
      {/* Top Header: Label on left, Squircle icon badge on right */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 pr-1">
          <span className="text-[13px] sm:text-sm font-medium text-[var(--hyper-text-secondary)] leading-tight block truncate">
            {label}
          </span>
          {subtitle && (
            <span className="text-[11px] text-[var(--hyper-text-tertiary)] block truncate mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-[14px] ${badgeBg} flex items-center justify-center shrink-0 transition-transform duration-150 group-active:scale-95`}
          aria-hidden="true"
        >
          <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2.2} />
        </div>
      </div>

      {/* Main Metric: Bold, tabular amount */}
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span
          className={`text-2xl sm:text-[28px] font-bold tracking-tight font-mono tabular-nums leading-none ${amountColor}`}
        >
          {amount}
        </span>

        {/* Optional Trend or Context Badge */}
        {trendText && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              trend === 'up'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : trend === 'down'
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-black/5 dark:bg-white/10 text-[var(--hyper-text-secondary)]'
            }`}
          >
            {trendText}
          </span>
        )}
      </div>
    </HyperCard>
  );
};

export default StatTile;
