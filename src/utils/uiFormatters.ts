/**
 * Bhuiya Property Manager — Presentation-Level Formatting Utilities
 * Version 3.1
 * 
 * Provides:
 * - formatMoney: Bangladeshi Taka formatting with bn-BD lakh/crore grouping (৳১,২৫,০০০)
 * - formatDate: Dhaka timezone-aware date formatting (Asia/Dhaka)
 * - formatMonth: Month and year formatting (e.g. "নভেম্বর ২০২৬" or "November 2026")
 * - formatNumber: Generic number formatting with Bengali/English digit toggle
 * 
 * Invariants:
 * - Does NOT modify existing services or src/utils/dhakaDate.ts
 * - Uses Asia/Dhaka timezone
 * - Supports user preferences for Bangla vs English digits
 */

const BANGLA_DIGITS_MAP: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

const BANGLA_MONTHS: Record<string, string> = {
  '01': 'জানুয়ারি',
  '02': 'ফেব্রুয়ারি',
  '03': 'মার্চ',
  '04': 'এপ্রিল',
  '05': 'মে',
  '06': 'জুন',
  '07': 'জুলাই',
  '08': 'আগস্ট',
  '09': 'সেপ্টেম্বর',
  '10': 'অক্টোবর',
  '11': 'নভেম্বর',
  '12': 'ডিসেম্বর',
};

const ENGLISH_MONTHS: Record<string, string> = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};

export interface FormatOptions {
  locale?: 'bn' | 'en';
  useBanglaDigits?: boolean;
}

/**
 * Converts Western digits to Bengali digits.
 */
export function toBengaliNumerals(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '০';
  return String(val).replace(/[0-9]/g, (d) => BANGLA_DIGITS_MAP[d] || d);
}

/**
 * Formats a raw number with Indian/Bangladeshi numbering system (lakh/crore grouping).
 * e.g. 125000 -> "1,25,000"
 */
export function formatLakhGrouping(val: number): string {
  return Math.abs(val).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

/**
 * Formats monetary amounts into Bangladeshi Taka format with proper lakh/crore grouping.
 * 
 * Example:
 * - formatMoney(125000, { useBanglaDigits: true }) -> "৳১,২৫,০০০"
 * - formatMoney(125000, { useBanglaDigits: false }) -> "৳1,25,000"
 * - formatMoney(-5000, { useBanglaDigits: true }) -> "-৳৫,০০০"
 */
export function formatMoney(
  amount: number | null | undefined,
  options: FormatOptions = {}
): string {
  const { useBanglaDigits = false } = options;
  if (amount === null || amount === undefined || isNaN(amount)) {
    return useBanglaDigits ? '৳০' : '৳0';
  }

  const isNegative = amount < 0;
  const grouped = formatLakhGrouping(amount);

  if (useBanglaDigits) {
    const banglaNum = toBengaliNumerals(grouped);
    return isNegative ? `-৳${banglaNum}` : `৳${banglaNum}`;
  }

  return isNegative ? `-৳${grouped}` : `৳${grouped}`;
}

/**
 * Formats a generic number with optional Bengali numerals and decimal control.
 */
export function formatNumber(
  val: number | null | undefined,
  options: FormatOptions & { fractionDigits?: number } = {}
): string {
  const { useBanglaDigits = false, fractionDigits = 0 } = options;
  if (val === null || val === undefined || isNaN(val)) {
    return useBanglaDigits ? '০' : '0';
  }

  const formatted = val.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  return useBanglaDigits ? toBengaliNumerals(formatted) : formatted;
}

/**
 * Formats YYYY-MM string or Date into localized month and year.
 * Example:
 * - formatMonth("2026-11", { locale: 'bn', useBanglaDigits: true }) -> "নভেম্বর ২০২৬"
 * - formatMonth("2026-11", { locale: 'en' }) -> "November 2026"
 */
export function formatMonth(
  monthStr: string | null | undefined,
  options: FormatOptions = {}
): string {
  const { locale = 'bn', useBanglaDigits = locale === 'bn' } = options;
  if (!monthStr || !monthStr.includes('-')) {
    return locale === 'bn' ? 'বর্তমান মাস' : 'Current Month';
  }

  const [year, month] = monthStr.split('-');
  if (locale === 'bn') {
    const monthName = BANGLA_MONTHS[month] || month;
    const yearStr = useBanglaDigits ? toBengaliNumerals(year) : year;
    return `${monthName} ${yearStr}`;
  }

  const monthName = ENGLISH_MONTHS[month] || month;
  return `${monthName} ${year}`;
}

/**
 * Formats any Date or timestamp into Dhaka timezone string (DD/MM/YYYY or Bengali text).
 */
export function formatDate(
  dateInput: Date | string | number | null | undefined,
  options: FormatOptions & { variant?: 'numeric' | 'long' } = {}
): string {
  const { locale = 'bn', useBanglaDigits = locale === 'bn', variant = 'numeric' } = options;
  if (!dateInput) return '—';

  const d = typeof dateInput === 'object' ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  // Format in Asia/Dhaka
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: variant === 'long' ? 'long' : '2-digit',
    year: 'numeric',
  });

  const parts = formatter.formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const year = parts.find((p) => p.type === 'year')?.value || '';

  if (variant === 'long') {
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    const monthName = locale === 'bn' ? BANGLA_MONTHS[monthNum] : month;
    const dayStr = useBanglaDigits ? toBengaliNumerals(day) : day;
    const yearStr = useBanglaDigits ? toBengaliNumerals(year) : year;
    return `${dayStr} ${monthName}, ${yearStr}`;
  }

  const numericStr = `${day}/${month}/${year}`;
  return useBanglaDigits ? toBengaliNumerals(numericStr) : numericStr;
}
