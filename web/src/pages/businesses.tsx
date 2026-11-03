import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';

type Business = { id: string; name: string; category: string; city: string; description: string };
type Category = { id: string; name: string };

const SEARCH_MAX_LENGTH = 100;

// Screen 6 and 7 (business directory with search and filter). REQ-3.3.1 every approved business, open
// to everyone; REQ-3.7.1 narrowed by words in the name or category; REQ-3.7.4 narrowed to one category.
// Both live in the address (?search=...&category=...), so a result can be shared and the back button
// returns to the previous one.
export function BusinessesPage() {
  const [params, setParams] = useSearchParams();
  const search = (params.get('search') ?? '').trim();
  const category = (params.get('category') ?? '').trim();
  const [query, setQuery] = useState(search);
  const [shownSearch, setShownSearch] = useState(search);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  // Back and forward change the address without going through the form, so the box follows it
  if (search !== shownSearch) {
    setShownSearch(search);
    setQuery(search);
  }

  // Changes one or both of the two filters and leaves the other as it was; an empty value removes it
  function update(change: { search?: string; category?: string }) {
    const next = new URLSearchParams(params);
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

      <CategoryFilter selected={category} onSelect={(name) => update({ category: name })} />

      <BusinessList
        key={`${search}|${category}`}
        search={search}
        category={category}
        onClearSearch={() => update({ search: '' })}
        onClearCategory={() => update({ category: '' })}
      />
    </section>
  );
}

// REQ-3.7.4 one button per business category, plus "All". The pressed one is the one in use.
function CategoryFilter({ selected, onSelect }: { selected: string; onSelect: (name: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const labelId = useId();

  useEffect(() => {
    apiRequest<{ categories: Category[] }>('/api/categories?type=business')
      .then((body) => setCategories(body.categories))
      // The directory works without the filter, so a failed request just leaves it out
      .catch((err) => console.error(err));
  }, []);

  if (categories.length === 0) return null;

  return (
    <div role="group" aria-labelledby={labelId} className="filter">
      <p id={labelId} className="filter__label">
        Filter by category
      </p>
      <ul className="filter__list">
        <li>
          <button type="button" className="chip" aria-pressed={!selected} onClick={() => onSelect('')}>
            All
          </button>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              className="chip"
              aria-pressed={selected.toLowerCase() === category.name.toLowerCase()}
              onClick={() => onSelect(category.name)}>
              {category.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ListProps = { search: string; category: string; onClearSearch: () => void; onClearCategory: () => void };

// Keyed by the search and the category, so each change starts from a clean state and shows its own loading indicator
function BusinessList({ search, category, onClearSearch, onClearCategory }: ListProps) {
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const filters = new URLSearchParams();
    if (search) filters.set('search', search);
    if (category) filters.set('category', category);
    const query = filters.size > 0 ? `?${filters}` : '';
    apiRequest<{ businesses: Business[] }>(`/api/businesses${query}`)
      .then((body) => setBusinesses(body.businesses))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, [search, category]);

  if (error) return <ErrorBanner message={error} />;
  if (!businesses) return <Spinner label="Loading businesses" />;

  if (businesses.length === 0) {
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

  const count = `${businesses.length} ${businesses.length === 1 ? 'business' : 'businesses'}`;
  return (
    <>
      {/* A status message, so a screen reader announces how many businesses were found */}
      <p role="status">{`${count}${search ? ` found for “${search}”` : ''}${category ? ` in ${category}` : ''}`}</p>
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
          <button type="button" className="link-button" onClick={onClearSearch}>
            Clear search
          </button>
        </p>
      )}
    </>
  );
}
