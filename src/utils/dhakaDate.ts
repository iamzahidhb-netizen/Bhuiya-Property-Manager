/**
 * dhakaDate.ts — Accurate dynamic date and weekday generation for Asia/Dhaka timezone
 */

export interface DhakaDateInfo {
  prefix: string;
  weekday: string;
  fullDate: string;
  weekdayLine: string;
}

export function getDhakaDateInfo(lang: 'bn' | 'en' = 'bn'): DhakaDateInfo {
  const now = new Date();

  // Asia/Dhaka weekday formatter
  const weekdayFormatter = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-BD', {
    timeZone: 'Asia/Dhaka',
    weekday: 'long',
  });

  // Asia/Dhaka date formatter
  const dateFormatter = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-BD', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const weekday = weekdayFormatter.format(now);
  const rawDate = dateFormatter.format(now);
  
  // Clean up any comma artifacts for clean Bengali typography (e.g., '৮ নভেম্বর, ২০২৬' -> '৮ নভেম্বর ২০২৬')
  const fullDate = rawDate.replace(',', '').trim();
  const prefix = lang === 'bn' ? 'আজ:' : 'Today:';

  return {
    prefix,
    weekday,
    fullDate,
    weekdayLine: `${prefix} ${weekday}`,
  };
}

export function getUserDisplayName(
  displayName?: string | null,
  email?: string | null
): string {
  if (displayName && displayName.trim()) {
    return displayName.trim();
  }
  if (email && email.trim()) {
    const raw = email.split('@')[0].trim();
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return 'User';
}

/**
 * Safely parses any date/timestamp representation (Firestore Timestamp, ISO string, Date, seconds object)
 * into numeric epoch milliseconds without throwing.
 */
export function parseTimestampMillis(val: unknown): number {
  if (!val) return 0;
  if (typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    try {
      return (val as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  if (typeof (val as { seconds?: number }).seconds === 'number') {
    return (val as { seconds: number }).seconds * 1000;
  }
  if (typeof val === 'string') {
    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  }
  if (val instanceof Date) {
    return val.getTime();
  }
  return 0;
}

/**
 * Safely formats any date/timestamp representation into a YYYY-MM-DD string without throwing.
 */
export function formatDateSafe(val: unknown, fallback = ''): string {
  if (!val) return fallback;
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      return val.slice(0, 10);
    }
    const t = new Date(val).getTime();
    if (!isNaN(t)) {
      return new Date(t).toISOString().slice(0, 10);
    }
    return val;
  }
  const ms = parseTimestampMillis(val);
  if (ms > 0) {
    return new Date(ms).toISOString().slice(0, 10);
  }
  return fallback;
}

