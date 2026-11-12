import { useMemo, useState } from 'react';

export interface PaginationResult<T> {
  pageItems: T[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  canPrev: boolean;
  canNext: boolean;
  goToPage: (page: number) => void;
  goPrev: () => void;
  goNext: () => void;
}

/**
 * Client-side pagination for long, already-filtered financial lists.
 * The hook only slices data for display; totals and financial figures are
 * always calculated from the full filtered collection by the caller.
 *
 * The page is stored together with the reset key so that changing a filter
 * ("Nov 2026|all|unpaid|query") resets to page 1 during render, without a
 * cascading setState inside an effect.
 */
export function usePagination<T>(
  items: readonly T[],
  pageSize = 8,
  resetKey = ''
): PaginationResult<T> {
  const [pageState, setPageState] = useState<{ key: string; page: number }>({
    key: resetKey,
    page: 1,
  });

  const requestedPage = pageState.key === resetKey ? pageState.page : 1;

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, requestedPage), pageCount);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const goToPage = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), pageCount);
    setPageState({ key: resetKey, page: clamped });
  };

  return {
    pageItems,
    page: safePage,
    pageCount,
    pageSize,
    total,
    rangeStart: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(total, safePage * pageSize),
    canPrev: safePage > 1,
    canNext: safePage < pageCount,
    goToPage,
    goPrev: () => goToPage(safePage - 1),
    goNext: () => goToPage(safePage + 1),
  };
}

export default usePagination;
