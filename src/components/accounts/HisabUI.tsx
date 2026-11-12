import React, { useId, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Search, type LucideIcon } from 'lucide-react';
import { HyperCard } from '../ui/hyperos/HyperCard';

export type HisabTone = 'green' | 'red' | 'blue' | 'orange' | 'purple' | 'neutral';

const TONE_TEXT: Record<HisabTone, string> = {
  green: 'text-[#1E9E42] dark:text-[#4ADE80]',
  red: 'text-[#D64545] dark:text-[#F87171]',
  blue: 'text-[#1272C8] dark:text-[#60A5FA]',
  orange: 'text-[#C26A0E] dark:text-[#FBBF24]',
  purple: 'text-[#6D4AD8] dark:text-[#A78BFA]',
  neutral: 'text-[var(--hyper-text-primary)]',
};

const TONE_TINT: Record<HisabTone, string> = {
  green: 'bg-[var(--hyper-green-bg)]',
  red: 'bg-[var(--hyper-red-bg)]',
  blue: 'bg-[var(--hyper-blue-bg)]',
  orange: 'bg-[var(--hyper-orange-bg)]',
  purple: 'bg-[var(--hyper-purple-bg)]',
  neutral: 'bg-black/[0.04] dark:bg-white/[0.06]',
};

export interface HisabMetricProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: HisabTone;
  className?: string;
}

/**
 * Compact financial metric cell used in the monthly overview and module
 * summary strips. Tabular numerals + truncation keep it overflow-safe on
 * 320px-wide Android viewports.
 */
export function HisabMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  className = '',
}: HisabMetricProps) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] p-2.5 sm:p-3.5 ${className}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="min-w-0 text-[11px] font-semibold leading-tight text-[var(--hyper-text-secondary)] sm:text-xs">
          {label}
        </span>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md sm:h-6 sm:w-6 sm:rounded-lg ${TONE_TINT[tone]}`}
          aria-hidden="true"
        >
          <Icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${TONE_TEXT[tone]}`} strokeWidth={2.2} />
        </span>
      </div>
      <div
        className={`mt-1 truncate font-mono text-[15px] font-bold tabular-nums leading-tight sm:text-lg ${TONE_TEXT[tone]}`}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 truncate text-[10px] font-medium leading-tight text-[var(--hyper-text-tertiary)]">
          {hint}
        </div>
      )}
    </div>
  );
}

export interface HisabSectionProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Collapsible secondary section for a financial module. Defaults to closed so
 * each tab stays compact; the header itself is the toggle (44px min height).
 */
export function HisabSection({
  title,
  subtitle,
  icon: Icon,
  badge,
  defaultOpen = false,
  children,
  className = '',
}: HisabSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <HyperCard className={`p-0 overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full min-h-12 items-center gap-2.5 p-3.5 text-left cursor-pointer select-none hover:bg-[var(--hyper-bg-card-hover)] transition-colors"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--hyper-green-bg)]">
          <Icon className="h-4 w-4 text-[var(--hyper-green)]" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[var(--hyper-text-primary)]">
            {title}
          </span>
          {subtitle && (
            <span className="block truncate text-[11px] font-medium text-[var(--hyper-text-secondary)]">
              {subtitle}
            </span>
          )}
        </span>
        {badge}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--hyper-text-secondary)] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={panelId}
          className="border-t border-[var(--hyper-border-subtle)] px-3.5 pb-3.5 pt-3 animate-in fade-in duration-150"
        >
          {children}
        </div>
      )}
    </HyperCard>
  );
}

export interface HisabPaginationProps {
  page: number;
  pageCount: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  labels: {
    page: string;
    of: string;
    prev: string;
    next: string;
    showing: string;
    items: string;
    total: string;
  };
}

/**
 * Pagination control for long transaction histories. Renders nothing when a
 * single page holds the whole list.
 */
export function HisabPagination({
  page,
  pageCount,
  total,
  rangeStart,
  rangeEnd,
  canPrev,
  canNext,
  onPrev,
  onNext,
  labels,
}: HisabPaginationProps) {
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <p className="text-[11px] font-medium text-[var(--hyper-text-secondary)]">
        {labels.showing}{' '}
        <span className="font-bold tabular-nums text-[var(--hyper-text-primary)]">
          {rangeStart}–{rangeEnd}
        </span>{' '}
        / {labels.total}{' '}
        <span className="font-bold tabular-nums text-[var(--hyper-text-primary)]">{total}</span>{' '}
        {labels.items}
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label={labels.prev}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-[74px] text-center text-[11px] font-bold tabular-nums text-[var(--hyper-text-secondary)]">
            {labels.page} {page} {labels.of} {pageCount}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            aria-label={labels.next}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] text-[var(--hyper-text-primary)] transition-colors hover:bg-[var(--hyper-bg-card-hover)] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

export interface HisabEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function HisabEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: HisabEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] px-4 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--hyper-green-bg)]">
        <Icon className="h-5 w-5 text-[var(--hyper-green)]" aria-hidden="true" />
      </span>
      <p className="text-sm font-bold text-[var(--hyper-text-primary)]">{title}</p>
      <p className="max-w-sm text-xs font-medium text-[var(--hyper-text-secondary)]">{description}</p>
      {action}
    </div>
  );
}

export interface HisabSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}

export function HisabSearchInput({
  value,
  onChange,
  placeholder,
  label,
  className = '',
}: HisabSearchInputProps) {
  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--hyper-text-tertiary)]"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="hyper-input-field w-full py-2.5 pl-9 pr-3 text-xs font-medium placeholder:text-[var(--hyper-text-tertiary)]"
      />
    </div>
  );
}

export interface HisabFilterChipProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

export function HisabFilterChip({ label, count, active, onClick }: HisabFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
        active
          ? 'border-[var(--hyper-green)] bg-[var(--hyper-green)] text-white shadow-sm'
          : 'border-[var(--hyper-border-subtle)] bg-[var(--hyper-bg-card-subtle)] text-[var(--hyper-text-secondary)] hover:text-[var(--hyper-text-primary)] hover:bg-[var(--hyper-bg-card-hover)]'
      }`}
    >
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
            active ? 'bg-white/25 text-white' : 'bg-black/[0.06] dark:bg-white/10'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
