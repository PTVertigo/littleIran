import { useEffect, useState, type FormEvent } from 'react';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { TextAreaField } from '../components/text-area-field';
import { ApiError, apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';

const REASON_MAX = 500;

type Submission = {
  id: string;
  title: string;
  category: string;
  description: string;
  location: string;
  startsAt?: string;
  submittedAt: string;
  submitterId: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
};

type Pending = { businesses: Submission[]; events: Submission[] };
type Kind = 'businesses' | 'events';

const failure = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');

// Administrator dashboard. REQ-3.8.1 everything waiting for a decision; REQ-3.8.2 to 3.8.5 approve it, or reject
// it with the reason the submitter will be shown.
export function AdminPage() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiRequest<Pending>('/api/admin/submissions')
      .then(setPending)
      .catch((err) => setError(failure(err)));
  }, []);

  function decided(kind: Kind, item: Submission, outcome: 'approved' | 'rejected') {
    setPending((current) => current && { ...current, [kind]: current[kind].filter((s) => s.id !== item.id) });
    setMessage(`“${item.title}” was ${outcome}.`);
  }

  const total = pending ? pending.businesses.length + pending.events.length : 0;

  return (
    <section>
      <h1>Administration</h1>
      {/* A status message, so a screen reader announces each decision */}
      <p role="status" className={message ? 'success-banner' : undefined}>
        {message}
      </p>
      <h2>Pending submissions{pending ? ` (${total})` : ''}</h2>
      {error ? (
        <ErrorBanner message={error} />
      ) : !pending ? (
        <Spinner label="Loading submissions" />
      ) : total === 0 ? (
        <p>Nothing is waiting for review.</p>
      ) : null}
      {pending && (
        <>
          <SubmissionList heading="Businesses" kind="businesses" items={pending.businesses} onDecided={decided} />
          <SubmissionList heading="Events" kind="events" items={pending.events} onDecided={decided} />
        </>
      )}
    </section>
  );
}

function SubmissionList(props: {
  heading: string;
  kind: Kind;
  items: Submission[];
  onDecided: (kind: Kind, item: Submission, outcome: 'approved' | 'rejected') => void;
}) {
  if (props.items.length === 0) return null;
  return (
    <section aria-label={`Pending ${props.heading.toLowerCase()}`}>
      <h3>
        {props.heading} ({props.items.length})
      </h3>
      <ul className="card-grid">
        {props.items.map((item) => (
          <li key={item.id}>
            <SubmissionCard kind={props.kind} item={item} onDecided={props.onDecided} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SubmissionCard({ kind, item, onDecided }: { kind: Kind; item: Submission; onDecided: (kind: Kind, item: Submission, outcome: 'approved' | 'rejected') => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function decide(action: 'approve' | 'reject', body?: object) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/api/admin/${kind}/${encodeURIComponent(item.id)}/${action}`, { method: 'POST', body: body ?? {} });
      onDecided(kind, item, action === 'approve' ? 'approved' : 'rejected');
      return;
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.reason) setFieldError(err.fieldErrors.reason);
      else setError(failure(err));
    }
    setBusy(false);
  }

  function reject(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setFieldError('Give the reason for the rejection.');
      return;
    }
    setFieldError('');
    decide('reject', { reason: reason.trim() });
  }

  return (
    <article className="card">
      <h4>{item.title}</h4>
      <p className="card__meta">
        {item.category} · {item.location}
        {item.startsAt && (
          <>
            {' '}
            · <time dateTime={item.startsAt}>{formatDateTime(item.startsAt)}</time>
          </>
        )}
      </p>
      <p>{item.description}</p>
      <p className="card__meta">
        Submitted by {item.submitterName ?? 'a former member'}
        {item.submitterEmail && ` (${item.submitterEmail})`} on <time dateTime={item.submittedAt}>{formatDateTime(item.submittedAt)}</time>
      </p>
      {error && <ErrorBanner message={error} />}
      {rejecting ? (
        <form onSubmit={reject} noValidate>
          <TextAreaField
            label={`Reason for rejecting “${item.title}”`}
            value={reason}
            rows={3}
            maxLength={REASON_MAX}
            hint="The member sees this, so they can improve the submission."
            error={fieldError}
            onChange={(e) => setReason(e.target.value)}
          />
          <p>
            <button type="submit" className="button" disabled={busy}>
              Reject<span className="visually-hidden"> {item.title}</span>
            </button>{' '}
            <button type="button" className="link-button" onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </p>
        </form>
      ) : (
        <p>
          <button type="button" className="button" disabled={busy} onClick={() => decide('approve')}>
            Approve<span className="visually-hidden"> {item.title}</span>
          </button>{' '}
          <button type="button" className="link-button" onClick={() => setRejecting(true)}>
            Reject<span className="visually-hidden"> {item.title}</span>…
          </button>
        </p>
      )}
    </article>
  );
}
