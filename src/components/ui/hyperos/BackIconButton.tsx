import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface BackIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

export function BackIconButton({
  className = '',
  ...props
}: BackIconButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--hyper-border-subtle)] bg-black/5 text-[var(--hyper-text-primary)] transition-colors hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 ${className}`}
      {...props}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
