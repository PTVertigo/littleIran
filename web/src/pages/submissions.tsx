import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';
import { formatDateTime } from '../lib/format';

type Submission = {
  id: string;
  title: string;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  submittedAt: string;
};

type Result = { businesses: Submission[]; events: Submission[] };

const STATUS_LABEL = { pending: 'Waiting for review', approved: 'Approved', rejected: 'Rejected' } as const;

// REQ-3.6.1 the member's own businesses and events with where each stands. REQ-3.6.2 a rejected one shows the
// reason. REQ-3.6.3 a rejected one can be improved and sent again.
export function SubmissionsPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<Result>('/api/submissions')
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, []);

  if (error) {
    return (
      <section>
        <h1>My submissions</h1>
        <ErrorBanner message={error} />
      </section>
    );
  }
  if (!result) {
    return (
      <section>
        <h1>My submissions</h1>
        <Spinner label="Loading your submissions" />
      </section>
    );
  }

  const none = result.businesses.length + result.events.length === 0;
  return (
    <section>
      <h1>My submissions</h1>
      <p className="muted">Every business and event you have submitted, and where it stands.</p>
      {none && (
        <p>
          You have not submitted anything yet. <Link to="/businesses/new">Add a business</Link> or <Link to="/events/new">add an event</Link>.
        </p>
      )}
      <SubmissionList heading="Businesses" resubmit="/businesses/new" items={result.businesses} />
      <SubmissionList heading="Events" resubmit="/events/new" items={result.events} />
    </section>
  );
}

function SubmissionList({ heading, resubmit, items }: { heading: string; resubmit: string; items: Submission[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`submissions-${heading}`}>
      <h2 id={`submissions-${heading}`}>
        {heading} ({items.length})
      </h2>
      <ul className="card-grid">
        {items.map((item) => (
          <li key={item.id}>
            <article className="card">
              <h3>{item.title}</h3>
              <p className="card__meta">
                {item.category} · Submitted <time dateTime={item.submittedAt}>{formatDateTime(item.submittedAt)}</time>
              </p>
              {/* The word, not only a colour, says where it stands */}
              <p>
                Status: <strong>{STATUS_LABEL[item.status]}</strong>
              </p>
              {item.status === 'rejected' && (
                <>
                  <p>Reason: {item.rejectionReason}</p>
                  <p>
                    <Link to={`${resubmit}?resubmit=${item.id}`} className="button">
                      Edit and resubmit<span className="visually-hidden"> {item.title}</span>
                    </Link>
                  </p>
                </>
              )}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
