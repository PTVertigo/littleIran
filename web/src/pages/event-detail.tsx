import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';
import { formatEventWhen } from '../lib/format';

type EventDetail = {
  id: string;
  title: string;
  category: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  organizerName: string;
  organizerContact: string;
  past: boolean;
};

// The organizer's contact is free text. Only something shaped like an email address becomes a link.
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

// Screen 5 detail. REQ-3.4.2 name, date, time, location, description, category and organizer information.
// Keyed by the id, so moving from one event to another starts from a clean state.
export function EventDetailPage() {
  const { id = '' } = useParams();
  return <EventDetailView key={id} id={id} />;
}

function EventDetailView({ id }: { id: string }) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    apiRequest<{ event: EventDetail }>(`/api/events/${encodeURIComponent(id)}`)
      .then((body) => current && setEvent(body.event))
      .catch((err) => {
        if (!current) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      current = false;
    };
  }, [id]);

  const back = (
    <p>
      <Link to="/events">Back to the events</Link>
    </p>
  );

  if (notFound) {
    return (
      <section>
        {back}
        <h1>Event not found</h1>
        <p>This event does not exist, or it has not been published.</p>
      </section>
    );
  }

  if (!event) {
    return (
      <section>
        {back}
        <h1>Event</h1>
        {error ? <ErrorBanner message={error} /> : <Spinner label="Loading the event" />}
      </section>
    );
  }

  return (
    <section>
      {back}
      <h1>{event.title}</h1>
      <p className="card__meta">
        {event.category}
        {event.past && ' · Past event'}
      </p>
      <p>{event.description}</p>

      <h2>When and where</h2>
      <dl className="details">
        <dt>Date and time</dt>
        <dd>
          <time dateTime={event.startsAt}>{formatEventWhen(event.startsAt, event.endsAt)}</time>
        </dd>
        <dt>Location</dt>
        <dd>{event.location}</dd>
      </dl>

      <h2>Organizer</h2>
      <dl className="details">
        <dt>Name</dt>
        <dd>{event.organizerName}</dd>
        <dt>Contact</dt>
        <dd>{EMAIL.test(event.organizerContact) ? <a href={`mailto:${event.organizerContact}`}>{event.organizerContact}</a> : event.organizerContact}</dd>
      </dl>
    </section>
  );
}
