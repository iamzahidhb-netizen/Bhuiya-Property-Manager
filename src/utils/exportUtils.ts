/**
 * Currency and export utility functions for Bhuiya Property Manager.
 */

/**
 * Format a number into BDT (Bangladeshi Taka) currency string.
 * Example: 185000 -> "৳1,85,000"
 */
export function formatBDT(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '৳0';
  }
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = absVal.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
  return isNegative ? `-৳${formatted}` : `৳${formatted}`;
}

/**
 * Format a standard ISO date or Timestamp into a human-readable string.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return dateStr;
}

/**
 * Export data to a CSV file with UTF-8 BOM for Microsoft Excel Bengali language support.
 *
 * @param filename File name without extension (e.g., "monthly-financial-report-2026-11")
 * @param headers Column headers
 * @param rows Data rows
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const sanitizeCell = (cell: string | number | boolean | null | undefined): string => {
    if (cell === null || cell === undefined) return '""';
    const cellStr = String(cell);
    // Escape double quotes by doubling them, wrap in quotes if contains comma, quote, or newline
    const escaped = cellStr.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const headerLine = headers.map(sanitizeCell).join(',');
  const rowLines = rows.map((row) => row.map(sanitizeCell).join(','));
  const csvContent = [headerLine, ...rowLines].join('\r\n');

  // Prepend UTF-8 BOM (\uFEFF) so Excel natively recognizes UTF-8 Bengali characters
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Trigger browser native print for the active report.
 */
export function printCurrentReport(): void {
  window.print();
}
