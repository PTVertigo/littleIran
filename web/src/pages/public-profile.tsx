import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest } from '../lib/api';

type PublicUser = { id: string; firstName: string; lastName: string; submissionCount: number };

// Screen 3 as other members see it. REQ-3.2.3 name and submission count, nothing private.
// Keyed by the id, so moving from one member to another starts from a clean state.
export function PublicProfilePage() {
  const { id = '' } = useParams();
  return <PublicProfile key={id} id={id} />;
}

function PublicProfile({ id }: { id: string }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    apiRequest<{ user: PublicUser }>(`/api/users/${encodeURIComponent(id)}`)
      .then((body) => current && setUser(body.user))
      .catch((err) => {
        if (!current) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      current = false;
    };
  }, [id]);

  if (notFound) {
    return (
      <section>
        <h1>User not found</h1>
        <p>This member does not exist or is no longer active.</p>
        <p>
          <Link to="/">Go to the home page</Link>
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1>{user ? `${user.firstName} ${user.lastName}` : 'Member profile'}</h1>
      {error && <ErrorBanner message={error} />}
      {!error && !user && <Spinner label="Loading the profile" />}
      {user && (
        <dl className="details">
          <dt>Submissions</dt>
          <dd>{user.submissionCount}</dd>
        </dl>
      )}
    </section>
  );
}
