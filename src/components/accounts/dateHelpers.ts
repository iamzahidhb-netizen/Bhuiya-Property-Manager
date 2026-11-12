/**
 * Small date helpers shared by the Hisab dashboard panels.
 * These only normalize display values; financial month grouping always
 * delegates to `financialSummary` helpers.
 */
export function resolveDateMonth(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 7);
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') {
    try {
      return maybeTimestamp.toDate().toISOString().slice(0, 7);
    } catch {
      return '';
    }
  }
  return '';
}

export function resolveActivityTimestamp(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === 'function') {
    try {
      return maybeTimestamp.toDate().getTime();
    } catch {
      return 0;
    }
  }
  return 0;
}
