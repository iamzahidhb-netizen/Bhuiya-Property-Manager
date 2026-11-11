import React from 'react';

export type StatusBadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
}

const TONE_CLASSES: Record<StatusBadgeTone, string> = {
  success: 'bg-[var(--hyper-green-bg)] text-[var(--hyper-green)] border-[var(--hyper-green)]/20',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300',
  danger: 'bg-[var(--hyper-red-bg)] text-[var(--hyper-red)] border-[var(--hyper-red)]/20',
  info: 'bg-[var(--hyper-blue-bg)] text-[var(--hyper-blue)] border-[var(--hyper-blue)]/20',
  neutral: 'bg-black/5 dark:bg-white/10 text-[var(--hyper-text-secondary)] border-[var(--hyper-border-subtle)]',
};

export function StatusBadge({
  children,
  tone = 'neutral',
  className = '',
}: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none ${TONE_CLASSES[tone]} ${className}`}>
      {children}
    </span>
  );
}
