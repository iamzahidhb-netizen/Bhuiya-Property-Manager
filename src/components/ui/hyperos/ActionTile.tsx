import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type ActionTileColor = 'green' | 'blue' | 'orange' | 'purple' | 'red';

export interface ActionTileProps {
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  color?: ActionTileColor;
  onClick: () => void;
  disabled?: boolean;
  layout?: 'vertical' | 'horizontal';
  className?: string;
}

const colorMap: Record<ActionTileColor, { badgeBg: string; iconColor: string }> = {
  green: {
    badgeBg: 'bg-gradient-to-br from-[#22B84A] to-[#1EA342] text-white shadow-sm shadow-[#22B84A]/30',
    iconColor: 'text-white',
  },
  blue: {
    badgeBg: 'bg-gradient-to-br from-[#1685E8] to-[#1272C7] text-white shadow-sm shadow-[#1685E8]/30',
    iconColor: 'text-white',
  },
  orange: {
    badgeBg: 'bg-gradient-to-br from-[#F28A24] to-[#DB7718] text-white shadow-sm shadow-[#F28A24]/30',
    iconColor: 'text-white',
  },
  purple: {
    badgeBg: 'bg-gradient-to-br from-[#7655E8] to-[#6343D4] text-white shadow-sm shadow-[#7655E8]/30',
    iconColor: 'text-white',
  },
  red: {
    badgeBg: 'bg-gradient-to-br from-[#E94B4B] to-[#D43838] text-white shadow-sm shadow-[#E94B4B]/30',
    iconColor: 'text-white',
  },
};

/**
 * ActionTile: Xiaomi HyperOS inspired colorful squircle quick-action button.
 * Designed for Quick Actions and shortcuts with 44px minimum touch target.
 */
export const ActionTile: React.FC<ActionTileProps> = ({
  label,
  sublabel,
  icon: Icon,
  color = 'green',
  onClick,
  disabled = false,
  layout = 'vertical',
  className = '',
}) => {
  const { badgeBg, iconColor } = colorMap[color];

  if (layout === 'horizontal') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full min-h-[52px] p-3 rounded-[20px] bg-[var(--hyper-bg-card)] border border-[var(--hyper-border)] hover:bg-[var(--hyper-bg-card-hover)] active:scale-[0.98] transition-all duration-150 flex items-center gap-3 text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none [box-shadow:var(--hyper-inner-highlight),var(--hyper-shadow-card)] ${className}`}
      >
        <div
          className={`w-10 h-10 rounded-[14px] ${badgeBg} flex items-center justify-center shrink-0`}
          aria-hidden="true"
        >
          <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-[var(--hyper-text-primary)] block truncate">
            {label}
          </span>
          {sublabel && (
            <span className="text-xs text-[var(--hyper-text-secondary)] block truncate">
              {sublabel}
            </span>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[96px] p-3 sm:p-4 rounded-[24px] bg-[var(--hyper-bg-card)] border border-[var(--hyper-border)] hover:bg-[var(--hyper-bg-card-hover)] active:scale-[0.97] transition-all duration-150 flex flex-col items-center justify-center text-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none [box-shadow:var(--hyper-inner-highlight),var(--hyper-shadow-card)] group ${className}`}
    >
      <div
        className={`w-12 h-12 rounded-[16px] ${badgeBg} flex items-center justify-center shrink-0 mb-2 transition-transform duration-150 group-active:scale-95`}
        aria-hidden="true"
      >
        <Icon className={`w-6 h-6 ${iconColor}`} strokeWidth={2.2} />
      </div>
      <span className="text-xs sm:text-[13px] font-semibold text-[var(--hyper-text-primary)] leading-tight tracking-tight line-clamp-1 max-w-full">
        {label}
      </span>
      {sublabel && (
        <span className="text-[10px] text-[var(--hyper-text-secondary)] mt-0.5 line-clamp-1">
          {sublabel}
        </span>
      )}
    </button>
  );
};

export default ActionTile;
