import { useEffect, useState } from 'react';

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

// Screen 4 (cultural events). REQ-3.4.1 every approved event, open to everyone: events still to come
// first, soonest first, then the ones that have finished.
export function EventsPage() {
  return (
    <section>
      <h1>Cultural events</h1>
      <p className="muted">Festivals, workshops and gatherings across Southern Ontario. Times are Ontario time.</p>
      <EventList />
    </section>
  );
}

function EventList() {
  const [events, setEvents] = useState<CulturalEvent[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ events: CulturalEvent[] }>('/api/events')
      .then((body) => setEvents(body.events))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!events) return <Spinner label="Loading events" />;
  if (events.length === 0) return <p>No events have been listed yet.</p>;

  return (
    <>
      {/* A status message, so a screen reader announces how many events there are */}
      <p role="status">{`${events.length} ${events.length === 1 ? 'event' : 'events'}`}</p>
      <ul className="card-grid">
        {events.map((event) => (
          <li key={event.id}>
            <article className="card">
              <h2>{event.title}</h2>
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
    </>
  );
}
