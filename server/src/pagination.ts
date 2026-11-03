// REQ-3.7.7 / 3.7.8 listings are shown 10 to a page. The page number comes from ?page=, and like every
// other query value it is checked before it is used; it only ever travels as a query parameter.
export const PAGE_SIZE = 10;
const MAX_PAGE = 100_000;

export function parsePage(raw: unknown): { page: number } | { error: string } {
  if (raw === undefined) return { page: 1 };
  // ?page=1&page=2 arrives as a list, and ?page[x]=1 as an object
  if (typeof raw !== 'string' || !/^[1-9]\d{0,5}$/.test(raw) || Number(raw) > MAX_PAGE) {
    return { error: 'Choose a page number from 1 upward.' };
  }
  return { page: Number(raw) };
}

export function pageDetails(page: number, total: number) {
  // An empty list still has one (empty) page, so "page 1 of 1" is always true
  return { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
