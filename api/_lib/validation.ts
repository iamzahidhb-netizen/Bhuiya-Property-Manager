/**
 * Validation routines and error classes for Vercel Serverless Functions.
 * Migrated directly from functions/index.js to preserve 100% logic equivalence.
 */

export class ApiError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = mapCodeToStatusCode(code);
  }
}

export function mapCodeToStatusCode(code: string): number {
  switch (code) {
    case 'unauthenticated':
      return 401;
    case 'permission-denied':
      return 403;
    case 'not-found':
      return 404;
    case 'invalid-argument':
      return 400;
    case 'already-exists':
      return 409;
    case 'failed-precondition':
      return 412;
    case 'resource-exhausted':
      return 429;
    default:
      return 500;
  }
}

// Allowed unit types
export const ALLOWED_UNIT_TYPES = new Set([
  'flat',
  'commercial',
  'office',
  'shop',
  'garage',
  'warehouse',
  'other',
]);

// Reserved JavaScript object prototype keys to prevent prototype collision / pollution
export const DISALLOWED_UNIT_KEYS = new Set([
  'constructor',
  'prototype',
  '__proto__',
  'tostring',
  'valueof',
  'hasownproperty',
  'isprototypeof',
  'propertyisenumerable',
  'tolocalestring',
]);

export const VALID_NORMALIZED_REGEX = /^[a-z0-9]+$/;
export const ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Validates and normalizes unitNumber on the trusted backend.
 */
export function validateAndNormalizeUnitNumber(unitNumber: unknown): { trimmed: string; normalized: string } {
  if (typeof unitNumber !== 'string') {
    throw new ApiError('invalid-argument', 'unitNumber must be a string.');
  }

  const trimmed = unitNumber.trim();
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw new ApiError('invalid-argument', 'unitNumber length must be between 1 and 50 characters.');
  }

  const normalized = trimmed.toLowerCase().replace(/[\s\-_.,#/]+/g, '');

  if (!normalized || !VALID_NORMALIZED_REGEX.test(normalized)) {
    throw new ApiError('invalid-argument', 'Normalized unit number must be alphanumeric (^[a-z0-9]+$).');
  }

  if (normalized.length > 32) {
    throw new ApiError('invalid-argument', 'Normalized unit number cannot exceed 32 characters.');
  }

  if (DISALLOWED_UNIT_KEYS.has(normalized)) {
    throw new ApiError('invalid-argument', `Unit number "${unitNumber}" resolves to a reserved prototype identifier.`);
  }

  return { trimmed, normalized };
}

export function validateId(id: unknown, fieldName: string): string {
  if (typeof id !== 'string' || !ID_REGEX.test(id)) {
    throw new ApiError('invalid-argument', `Invalid or missing ${fieldName}.`);
  }
  return id;
}

export function validateNumber(
  value: unknown,
  fieldName: string,
  { min = 0, max = Infinity, integerOnly = false }: { min?: number; max?: number; integerOnly?: boolean } = {}
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError('invalid-argument', `${fieldName} must be a valid, finite number.`);
  }
  if (value < min || value > max) {
    throw new ApiError('invalid-argument', `${fieldName} must be between ${min} and ${max}.`);
  }
  if (integerOnly && !Number.isInteger(value)) {
    throw new ApiError('invalid-argument', `${fieldName} must be an integer.`);
  }
  return value;
}

export function validateOptionalString(value: unknown, fieldName: string, maxLength = 64): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw new ApiError('invalid-argument', `${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ApiError('invalid-argument', `${fieldName} exceeds maximum length of ${maxLength}.`);
  }
  return trimmed;
}

export function validateMonth(month: unknown, fieldName = 'distributionMonth'): string {
  if (typeof month !== 'string' || !MONTH_REGEX.test(month)) {
    throw new ApiError('invalid-argument', `${fieldName} must be in YYYY-MM format.`);
  }
  return month;
}

export function validateDate(dateStr: unknown, fieldName: string): string {
  if (typeof dateStr !== 'string' || !DATE_REGEX.test(dateStr)) {
    throw new ApiError('invalid-argument', `${fieldName} must be a valid date in YYYY-MM-DD format.`);
  }
  return dateStr;
}

export function hasUnitMapping(activeMap: Record<string, unknown> | null | undefined, key: string): boolean {
  if (!activeMap || typeof activeMap !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(activeMap, key);
}

export function createSafeMapping(rawMap: Record<string, string> | null | undefined): Record<string, string> {
  const safe: Record<string, string> = Object.create(null);
  if (rawMap && typeof rawMap === 'object') {
    for (const key of Object.keys(rawMap)) {
      if (Object.prototype.hasOwnProperty.call(rawMap, key)) {
        safe[key] = rawMap[key];
      }
    }
  }
  return safe;
}
