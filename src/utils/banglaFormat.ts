/**
 * Bengali & English Number, Date, and Currency Formatting Utilities
 * For Anwar Bhuiyan Property (আনোয়ার ভূঁইয়া প্রপার্টি)
 */

const BANGLA_DIGITS: Record<string, string> = {
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

const REVERSE_BANGLA_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export const BANGLA_MONTH_NAMES: Record<string, string> = {
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

export const ENGLISH_MONTH_NAMES: Record<string, string> = {
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

/**
 * Converts Western digits in a string or number to Bengali digits.
 */
export function toBanglaNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return '০';
  const str = String(val);
  return str.replace(/[0-9]/g, (digit) => BANGLA_DIGITS[digit] || digit);
}

/**
 * Safely parses any input that may contain Bengali digits into a standard number.
 */
export function parseBanglaNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const normalized = String(val)
    .replace(/[০-৯]/g, (d) => REVERSE_BANGLA_DIGITS[d] || d)
    .replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats a number into Bangladeshi Taka format with optional Bengali numerals.
 * Example: 25000 -> "৳২৫,০০০"
 */
export function formatBanglaCurrency(amount: number | null | undefined, useBanglaDigits = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return useBanglaDigits ? '৳০' : '৳0';
  }
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = absVal.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });

  if (useBanglaDigits) {
    const banglaNum = toBanglaNumber(formatted);
    return isNegative ? `-৳${banglaNum}` : `৳${banglaNum}`;
  }

  return isNegative ? `-৳${formatted}` : `৳${formatted}`;
}

/**
 * Localized currency formatter based on active language or isBengali boolean.
 */
export function formatLocalizedCurrency(
  amount: number | null | undefined,
  langOrIsBengali: 'bn' | 'en' | boolean = true,
  useBanglaDigits = false
): string {
  const isBengali = typeof langOrIsBengali === 'string' ? langOrIsBengali === 'bn' : langOrIsBengali;
  if (amount === null || amount === undefined || isNaN(amount)) {
    return isBengali && useBanglaDigits ? '৳০' : '৳0';
  }
  return formatBanglaCurrency(amount, isBengali && useBanglaDigits);
}

/**
 * Formats YYYY-MM into human-readable Bengali month and year.
 * Example: "2026-11" -> "নভেম্বর ২০২৬"
 */
export function formatBanglaMonth(monthStr: string | null | undefined): string {
  if (!monthStr || !monthStr.includes('-')) return 'বর্তমান মাস';
  const [year, month] = monthStr.split('-');
  const monthName = BANGLA_MONTH_NAMES[month] || month;
  const banglaYear = toBanglaNumber(year);
  return `${monthName} ${banglaYear}`;
}

/**
 * Formats YYYY-MM into localized human-readable month and year based on language or isBengali boolean.
 */
export function formatLocalizedMonth(
  monthStr: string | null | undefined,
  langOrIsBengali: 'bn' | 'en' | boolean = true
): string {
  const isBengali = typeof langOrIsBengali === 'string' ? langOrIsBengali === 'bn' : langOrIsBengali;
  if (!monthStr || !monthStr.includes('-')) {
    return isBengali ? 'বর্তমান মাস' : 'Current Month';
  }
  const [year, month] = monthStr.split('-');
  if (isBengali) {
    const monthName = BANGLA_MONTH_NAMES[month] || month;
    return `${monthName} ${toBanglaNumber(year)}`;
  }
  const monthName = ENGLISH_MONTH_NAMES[month] || month;
  return `${monthName} ${year}`;
}
