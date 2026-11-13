import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { SelectField } from '../components/select-field';
import { Spinner } from '../components/spinner';
import { TextAreaField } from '../components/text-area-field';
import { TextField } from '../components/text-field';
import { ApiError, apiRequest } from '../lib/api';
import { validateEventForm, type EventForm, type EventFormErrors } from '../lib/event-validation';

type Category = { id: string; name: string };

const CHECK_MESSAGE = 'Check the fields marked below and try again.';

const emptyForm = (): EventForm => ({
  title: '',
  categoryId: '',
  description: '',
  location: '',
  date: '',
  startTime: '',
  endTime: '',
  organizerName: '',
  organizerContact: '',
});

// Screen "create event". REQ-3.4 a member submits an event, which waits for approval before it is public
export function NewEventPage() {
  // REQ-3.6.3 ?resubmit=<id> opens a rejected event of the member's own, filled in, to improve and send again
  const resubmitId = useSearchParams()[0].get('resubmit') ?? '';
  const [reason, setReason] = useState('');
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [values, setValues] = useState<EventForm>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<EventFormErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ categories: Category[] }>('/api/categories?type=event')
      .then((body) => setCategories(body.categories))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, []);

  useEffect(() => {
    if (!resubmitId) return;
    apiRequest<{ event: EventForm & { rejectionReason: string } }>(`/api/submissions/events/${encodeURIComponent(resubmitId)}`)
      .then(({ event }) => {
        const { rejectionReason, ...form } = event;
        setValues({ ...emptyForm(), ...form });
        setReason(rejectionReason);
      })
      .catch((err) =>
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? 'This event cannot be resubmitted. Only your own rejected events can.'
            : err instanceof ApiError
              ? err.message
              : 'Something went wrong. Please try again.',
        ),
      );
  }, [resubmitId]);

  function bind(field: keyof EventForm) {
    return {
      value: values[field],
      error: fieldErrors[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setValues({ ...values, [field]: e.target.value }),
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const errors = validateEventForm(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(CHECK_MESSAGE);
      return;
    }
    setError('');

    setLoading(true);
    try {
      const { event: created } = await apiRequest<{
        event: { id: string; title: string };
      }>(resubmitId ? `/api/events/${encodeURIComponent(resubmitId)}` : '/api/events', {
        method: resubmitId ? 'PUT' : 'POST',
        body: {
          title: values.title.trim(),
          categoryId: values.categoryId,
          description: values.description.trim(),
          location: values.location.trim(),
          date: values.date.trim(),
          startTime: values.startTime.trim(),
          endTime: values.endTime.trim(),
          organizerName: values.organizerName.trim(),
          organizerContact: values.organizerContact.trim(),
        },
      });
      setSubmitted(created.title);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors as EventFormErrors);
        setError(CHECK_MESSAGE);
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    }
    setLoading(false);
  }

  if (submitted !== null) {
    return (
      <section className="form-page">
        <h1>{resubmitId ? 'Event resubmitted' : 'Event submitted'}</h1>
        <p role="status" className="success-banner">
          Thank you. {submitted} has been {resubmitId ? 'resubmitted' : 'submitted'}. An administrator will review it, and it will appear on
          the events page once it is approved.
        </p>
        <p className="form-footer">
          <Link to="/submissions">See your submissions</Link>
        </p>
        <p className="form-footer">
          <Link to="/events">Back to the events</Link>
        </p>
        {!resubmitId && (
          <p className="form-footer">
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setValues(emptyForm());
                setFieldErrors({});
                setSubmitted(null);
              }}>
              Add another event
            </button>
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="form-page">
      <h1>{resubmitId ? 'Resubmit your event' : 'Add an event'}</h1>
      <p className="muted">
        {resubmitId
          ? 'Improve the event and send it again. An administrator will review it again.'
          : 'Tell the community about a cultural event. An administrator reviews every event before it is published.'}
      </p>
      {reason && (
        <p role="note" className="error-banner">
          Reason it was rejected: {reason}
        </p>
      )}

      {loadError && <ErrorBanner message={loadError} />}
      {!loadError && !categories && <Spinner label="Loading the form" />}

      {categories && (
        <form onSubmit={submit} noValidate className="form">
          {error && <ErrorBanner message={error} />}
          <TextField label="Event name" {...bind('title')} />
          <SelectField
            label="Category"
            placeholder="Choose a category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            {...bind('categoryId')}
          />
          <TextAreaField label="Description" hint="What happens at the event, in a few sentences." {...bind('description')} />
          <TextField
            label="Location"
            autoComplete="off"
            hint="The venue and its address, for example Hamilton Convention Centre, 1 Sample Street, Hamilton."
            {...bind('location')}
          />
          <TextField label="Date" type="date" hint="In Ontario." {...bind('date')} />
          <TextField label="Start time" type="time" hint="Ontario time." {...bind('startTime')} />
          <TextField label="End time (optional)" type="time" hint="On the same day." {...bind('endTime')} />
          <TextField label="Organizer name" autoComplete="organization" {...bind('organizerName')} />
          <TextField label="Organizer contact" hint="An email address or a phone number." {...bind('organizerContact')} />
          <button type="submit" className="button" disabled={loading}>
            {loading ? 'Submitting…' : resubmitId ? 'Resubmit for review' : 'Submit for review'}
          </button>
        </form>
      )}

      <p className="form-footer">
        <Link to="/events">Back to the events</Link>
      </p>
    </section>
  );
}
