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
