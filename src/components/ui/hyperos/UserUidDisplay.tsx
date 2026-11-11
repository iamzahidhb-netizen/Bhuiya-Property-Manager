import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatUserUid } from '../../../utils/formatUserUid';

interface UserUidDisplayProps {
  uid: string;
  className?: string;
}

export function UserUidDisplay({ uid, className = '' }: UserUidDisplayProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copyUid() {
    try {
      await navigator.clipboard.writeText(uid);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch (error) {
      console.error('Failed to copy user UID:', error);
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 3000);
    }
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <span className="truncate font-mono" title={formatUserUid(uid)}>
        {formatUserUid(uid)}
      </span>
      <button
        type="button"
        onClick={copyUid}
        aria-label={copyState === 'copied' ? 'UID copied' : 'Copy full UID'}
        title={copyState === 'failed' ? 'Could not copy UID' : copyState === 'copied' ? 'UID copied' : 'Copy full UID'}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--hyper-text-secondary)] hover:bg-black/5 hover:text-[var(--hyper-text-primary)] dark:hover:bg-white/10"
      >
        {copyState === 'copied' ? <Check className="h-4 w-4 text-[var(--hyper-green)]" /> : <Copy className="h-4 w-4" />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copyState === 'copied' ? 'UID copied' : copyState === 'failed' ? 'Could not copy UID' : ''}
      </span>
    </span>
  );
}
