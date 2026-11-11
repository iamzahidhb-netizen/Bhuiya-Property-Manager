import {
  BANGLA_MONTHS,
  ENGLISH_MONTHS,
  formatMoney,
  formatMonth,
  toBengaliNumerals,
} from './uiFormatters.ts';

export const BANGLA_MONTH_NAMES = BANGLA_MONTHS;
export const ENGLISH_MONTH_NAMES = ENGLISH_MONTHS;

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

export function toBanglaNumber(
  val: number | string | null | undefined
): string {
  return toBengaliNumerals(val);
}

export function parseBanglaNumber(
  val: string | number | null | undefined
): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const normalized = String(val)
    .replace(/[০-৯]/g, (digit) => REVERSE_BANGLA_DIGITS[digit] || digit)
    .replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatBanglaCurrency(
  amount: number | null | undefined,
  useBanglaDigits = false
): string {
  return formatMoney(amount, { useBanglaDigits });
}

export function formatLocalizedCurrency(
  amount: number | null | undefined,
  langOrIsBengali: 'bn' | 'en' | boolean = true,
  useBanglaDigits = false
): string {
  const isBengali =
    typeof langOrIsBengali === 'string'
      ? langOrIsBengali === 'bn'
      : langOrIsBengali;
  return formatMoney(amount, {
    useBanglaDigits: isBengali && useBanglaDigits,
  });
}

export function formatBanglaMonth(
  monthStr: string | null | undefined
): string {
  return formatMonth(monthStr, { locale: 'bn', useBanglaDigits: true });
}

export function formatLocalizedMonth(
  monthStr: string | null | undefined,
  langOrIsBengali: 'bn' | 'en' | boolean = true
): string {
  const isBengali =
    typeof langOrIsBengali === 'string'
      ? langOrIsBengali === 'bn'
      : langOrIsBengali;
  return formatMonth(monthStr, {
    locale: isBengali ? 'bn' : 'en',
    useBanglaDigits: isBengali,
  });
}
