import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { CategoryFilter } from '../components/category-filter';
import { ErrorBanner } from '../components/error-banner';
import { Pagination } from '../components/pagination';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';

type Business = { id: string; name: string; category: string; city: string; description: string };
type Result = { businesses: Business[]; page: number; pageSize: number; total: number; totalPages: number };

const SEARCH_MAX_LENGTH = 100;

// Screen 6 and 7 (business directory with search and filter). REQ-3.3.1 every approved business, open
// to everyone; REQ-3.7.1 narrowed by words in the name or category; REQ-3.7.4 narrowed to one category.
// REQ-3.7.7 ten businesses a page, with page navigation. All three live in the address
// (?search=...&category=...&page=...), so a result can be shared and the back button returns to the previous one.
export function BusinessesPage() {
  const [params, setParams] = useSearchParams();
  const search = (params.get('search') ?? '').trim();
  const category = (params.get('category') ?? '').trim();
  const rawPage = params.get('page') ?? '';
  const page = /^[1-9]\d{0,5}$/.test(rawPage) ? Number(rawPage) : 1;
  const [query, setQuery] = useState(search);
  const [shownSearch, setShownSearch] = useState(search);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  // Back and forward change the address without going through the form, so the box follows it
  if (search !== shownSearch) {
    setShownSearch(search);
    setQuery(search);
  }

  // Changes the search, the category or the page and leaves the others as they were; an empty value removes
  // it. A new search or category starts again from the first page.
  function update(change: { search?: string; category?: string; page?: string }) {
    const next = new URLSearchParams(params);
    if (!('page' in change)) next.delete('page');
    for (const [key, value] of Object.entries(change)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    update({ search: query.trim() });
  }

  return (
    <section>
      <h1>Business directory</h1>
      <p className="muted">Iranian-owned businesses across Southern Ontario.</p>
      <p className="page-actions">
        <Link to="/businesses/new" className="button">
          Add a business
        </Link>
      </p>

      <form role="search" className="search-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor={inputId}>Search businesses</label>
          <div className="search-form__row">
            <div className="field__control">
              <input
                id={inputId}
                type="search"
                value={query}
                maxLength={SEARCH_MAX_LENGTH}
                aria-describedby={hintId}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="button">
              Search
            </button>
          </div>
          <p id={hintId} className="field__hint">
            By name or category, for example “Persian restaurant”.
          </p>
        </div>
      </form>

      <CategoryFilter type="business" selected={category} onSelect={(name) => update({ category: name })} />

      <BusinessList
        key={`${search}|${category}`}
        search={search}
        category={category}
        page={page}
        onPageChange={(n) => update({ page: n > 1 ? String(n) : '' })}
        onClearSearch={() => update({ search: '' })}
        onClearCategory={() => update({ category: '' })}
      />
    </section>
  );
}

type ListProps = {
  search: string;
  category: string;
  page: number;
  onPageChange: (page: number) => void;
  onClearSearch: () => void;
  onClearCategory: () => void;
};

// Keyed by the search and the category, so each change starts from a clean state and shows its own loading
// indicator. Moving to another page keeps the old page (and the page buttons) on screen until the new one arrives.
function BusinessList({ search, category, page, onPageChange, onClearSearch, onClearCategory }: ListProps) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const statusRef = useRef<HTMLParagraphElement>(null);
  const movedPage = useRef(false);

  useEffect(() => {
    const filters = new URLSearchParams();
    if (search) filters.set('search', search);
    if (category) filters.set('category', category);
    if (page > 1) filters.set('page', String(page));
    const query = filters.size > 0 ? `?${filters}` : '';
    apiRequest<Result>(`/api/businesses${query}`)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, [search, category, page]);

  // After the buttons are used the new page has arrived somewhere above them, so keyboard focus goes to
  // its heading line: a screen reader reads which page it is, and the next Tab is the first business
  useEffect(() => {
    if (result && movedPage.current) {
      movedPage.current = false;
      statusRef.current?.focus();
    }
  }, [result]);

  if (error) return <ErrorBanner message={error} />;
  if (!result) return <Spinner label="Loading businesses" />;

  const { businesses, total, totalPages } = result;
  const changePage = (n: number) => {
    movedPage.current = true;
    onPageChange(n);
  };

  if (total === 0) {
    if (!search && !category) return <p>No businesses have been listed yet.</p>;
    return (
      <>
        <p role="status">
          {search && category
            ? `No businesses match “${search}” in ${category}. Try a different word or category.`
            : search
              ? `No businesses match “${search}”. Try a different word, or clear the search.`
              : `No businesses in ${category} yet.`}
        </p>
        <p>
          {search && (
            <button type="button" className="link-button" onClick={onClearSearch}>
              Clear search
            </button>
          )}
          {search && category && ' · '}
          {category && (
            <button type="button" className="link-button" onClick={onClearCategory}>
              Show all categories
            </button>
          )}
        </p>
      </>
    );
  }

  // A page number typed into the address that is past the last page
  if (businesses.length === 0) {
    return (
      <>
        <p role="status" tabIndex={-1} ref={statusRef}>
          {`There is no page ${result.page}. The results have ${totalPages} ${totalPages === 1 ? 'page' : 'pages'}.`}
        </p>
        <p>
          <button type="button" className="link-button" onClick={() => changePage(1)}>
            Go to the first page
          </button>
        </p>
      </>
    );
  }

  const noun = `${total === 1 ? 'business' : 'businesses'}`;
  const filters = `${search ? ` found for “${search}”` : ''}${category ? ` in ${category}` : ''}`;
  // A single page keeps the short count; several pages say which ones are shown
  const first = (result.page - 1) * result.pageSize + 1;
  const summary =
    totalPages === 1
      ? `${total} ${noun}${filters}`
      : `Showing ${first}–${first + businesses.length - 1} of ${total} ${noun}${filters}. Page ${result.page} of ${totalPages}.`;

  return (
    <>
      {/* A status message, so a screen reader announces how many businesses were found */}
      <p role="status" tabIndex={-1} ref={statusRef}>
        {summary}
      </p>
      <ul className="card-grid" aria-busy={result.page !== page}>
        {businesses.map((business) => (
          <li key={business.id}>
            <article className="card">
              <h2>
                {/* REQ-3.3.2 */}
                <Link to={`/businesses/${business.id}`}>{business.name}</Link>
              </h2>
              <p className="card__meta">
                {business.category} · {business.city}
              </p>
              <p>{business.description}</p>
            </article>
          </li>
        ))}
      </ul>
      <Pagination page={page} totalPages={totalPages} label="Business pages" onChange={changePage} />
      {search && (
        <p>
          <button type="button" className="link-button" onClick={onClearSearch}>
            Clear search
          </button>
        </p>
      )}
    </>
  );
}
