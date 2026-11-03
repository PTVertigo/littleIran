import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { CategoryFilter } from '../components/category-filter';
import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';

type CulturalEvent = {
  id: string;
  title: string;
  category: string;
  startsAt: string;
  location: string;
  description: string;
  past: boolean;
};

const SEARCH_MAX_LENGTH = 100;

// Screen 4 (cultural events). REQ-3.4.1 every approved event, open to everyone: events still to come
// first, soonest first, then the ones that have finished. REQ-3.7.2 narrowed by words in the name or
// category; REQ-3.7.5 narrowed to one category. Both live in the address (?search=...&category=...), so a
// result can be shared and the back button returns to the previous one.
export function EventsPage() {
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

  // Changes the search or the category and leaves the other as it was; an empty value removes it
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
      <h1>Cultural events</h1>
      <p className="muted">Festivals, workshops and gatherings across Southern Ontario. Times are Ontario time.</p>
      <p className="page-actions">
        <Link to="/events/new" className="button">
          Add an event
        </Link>
      </p>

      <form role="search" className="search-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor={inputId}>Search events</label>
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
            By name or category, for example “Persian workshop”.
          </p>
        </div>
      </form>

      <CategoryFilter type="event" selected={category} onSelect={(name) => update({ category: name })} />

      <EventList
        key={`${search}|${category}`}
        search={search}
        category={category}
        onClearSearch={() => update({ search: '' })}
        onClearCategory={() => update({ category: '' })}
      />
    </section>
  );
}

type ListProps = { search: string; category: string; onClearSearch: () => void; onClearCategory: () => void };

// Keyed by the search and the category, so each change starts from a clean state and shows its own loading indicator
function EventList({ search, category, onClearSearch, onClearCategory }: ListProps) {
  const [events, setEvents] = useState<CulturalEvent[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const filters = new URLSearchParams();
    if (search) filters.set('search', search);
    if (category) filters.set('category', category);
    const query = filters.size > 0 ? `?${filters}` : '';
    apiRequest<{ events: CulturalEvent[] }>(`/api/events${query}`)
      .then((body) => setEvents(body.events))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, [search, category]);

  if (error) return <ErrorBanner message={error} />;
  if (!events) return <Spinner label="Loading events" />;
  if (events.length === 0) {
    if (!search && !category) return <p>No events have been listed yet.</p>;
    return (
      <>
        <p role="status">
          {search && category
            ? `No events match “${search}” in ${category}. Try a different word or category.`
            : search
              ? `No events match “${search}”. Try a different word, or clear the search.`
              : `No events in ${category} yet.`}
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

  return (
    <>
      {/* A status message, so a screen reader announces how many events there are */}
      <p role="status">{`${events.length} ${events.length === 1 ? 'event' : 'events'}${search ? ` found for “${search}”` : ''}${category ? ` in ${category}` : ''}`}</p>
      <ul className="card-grid">
        {events.map((event) => (
          <li key={event.id}>
            <article className="card">
              <h2>
                {/* REQ-3.4.2 */}
                <Link to={`/events/${event.id}`}>{event.title}</Link>
              </h2>
              <p className="card__meta">
                {event.category}
                {event.past && ' · Past event'}
              </p>
              <p>
                <time dateTime={event.startsAt}>{formatDateTime(event.startsAt)}</time>
              </p>
              <p>{event.location}</p>
              <p>{event.description}</p>
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
