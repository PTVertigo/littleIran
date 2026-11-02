import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';

type Business = { id: string; name: string; category: string; city: string; description: string };

const SEARCH_MAX_LENGTH = 100;

// Screen 6 and 7 (business directory with search). REQ-3.3.1 every approved business, open to everyone;
// REQ-3.7.1 narrowed by words in the name or category. The search lives in the address (?search=...),
// so a result can be shared and the back button returns to the previous one.
export function BusinessesPage() {
  const [params, setParams] = useSearchParams();
  const search = (params.get('search') ?? '').trim();
  const [query, setQuery] = useState(search);
  const [shownSearch, setShownSearch] = useState(search);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  // Back and forward change the address without going through the form, so the box follows it
  if (search !== shownSearch) {
    setShownSearch(search);
    setQuery(search);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = query.trim();
    setParams(text ? { search: text } : {});
  }

  function clear() {
    setQuery('');
    setParams({});
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

      <BusinessList key={search} search={search} onClear={clear} />
    </section>
  );
}

// Keyed by the search, so each new search starts from a clean state and shows its own loading indicator
function BusinessList({ search, onClear }: { search: string; onClear: () => void }) {
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = search ? `?${new URLSearchParams({ search })}` : '';
    apiRequest<{ businesses: Business[] }>(`/api/businesses${query}`)
      .then((body) => setBusinesses(body.businesses))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, [search]);

  if (error) return <ErrorBanner message={error} />;
  if (!businesses) return <Spinner label="Loading businesses" />;

  if (businesses.length === 0) {
    return search ? (
      <>
        <p role="status">No businesses match “{search}”. Try a different word, or clear the search.</p>
        <p>
          <button type="button" className="link-button" onClick={onClear}>
            Clear search
          </button>
        </p>
      </>
    ) : (
      <p>No businesses have been listed yet.</p>
    );
  }

  const count = `${businesses.length} ${businesses.length === 1 ? 'business' : 'businesses'}`;
  return (
    <>
      {/* A status message, so a screen reader announces how many businesses the search found */}
      <p role="status">{search ? `${count} found for “${search}”` : count}</p>
      <ul className="card-grid">
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
      {search && (
        <p>
          <button type="button" className="link-button" onClick={onClear}>
            Clear search
          </button>
        </p>
      )}
    </>
  );
}
