// REQ-3.7.7 / 3.7.8 page navigation: Previous, numbered pages and Next. The current page is marked with
// aria-current, and the buttons at either end stay in place (aria-disabled) so keyboard focus is not lost.
type Props = { page: number; totalPages: number; label: string; onChange: (page: number) => void };

// Every page when there are few; otherwise the first, the last and the pages around the current one
function visiblePages(page: number, totalPages: number): (number | 'gap-before' | 'gap-after')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const wanted = new Set([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
  const pages = [...wanted].sort((a, b) => a - b);
  const result: (number | 'gap-before' | 'gap-after')[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) result.push(i === 1 ? 'gap-before' : 'gap-after');
    result.push(n);
  });
  return result;
}

export function Pagination({ page, totalPages, label, onChange }: Props) {
  if (totalPages <= 1) return null;

  const go = (target: number) => {
    if (target >= 1 && target <= totalPages && target !== page) onChange(target);
  };

  return (
    <nav aria-label={label} className="pagination">
      <ul className="pagination__list">
        <li>
          <button type="button" className="chip" aria-disabled={page <= 1} onClick={() => go(page - 1)}>
            Previous
          </button>
        </li>
        {visiblePages(page, totalPages).map((entry) =>
          typeof entry === 'string' ? (
            <li key={entry} aria-hidden="true" className="pagination__gap">
              …
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                className="chip"
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? 'page' : undefined}
                onClick={() => go(entry)}>
                {entry}
              </button>
            </li>
          ),
        )}
        <li>
          <button type="button" className="chip" aria-disabled={page >= totalPages} onClick={() => go(page + 1)}>
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
}
