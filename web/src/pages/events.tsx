import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

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
// category. The search lives in the address (?search=...), so a result can be shared and the back button
// returns to the previous one.
export function EventsPage() {
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

  function update(text: string) {
    const next = new URLSearchParams(params);
    if (text) next.set('search', text);
    else next.delete('search');
    setParams(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    update(query.trim());
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

      <EventList key={search} search={search} onClearSearch={() => update('')} />
    </section>
  );
}

// Keyed by the search, so each search starts from a clean state and shows its own loading indicator
function EventList({ search, onClearSearch }: { search: string; onClearSearch: () => void }) {
  const [events, setEvents] = useState<CulturalEvent[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = search ? `?${new URLSearchParams({ search })}` : '';
    apiRequest<{ events: CulturalEvent[] }>(`/api/events${query}`)
      .then((body) => setEvents(body.events))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, [search]);

  if (error) return <ErrorBanner message={error} />;
  if (!events) return <Spinner label="Loading events" />;
  if (events.length === 0) {
    if (!search) return <p>No events have been listed yet.</p>;
    return (
      <>
        <p role="status">{`No events match “${search}”. Try a different word, or clear the search.`}</p>
        <p>
          <button type="button" className="link-button" onClick={onClearSearch}>
            Clear search
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      {/* A status message, so a screen reader announces how many events there are */}
      <p role="status">{`${events.length} ${events.length === 1 ? 'event' : 'events'}${search ? ` found for “${search}”` : ''}`}</p>
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
