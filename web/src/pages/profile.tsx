import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { ErrorBanner } from '../components/error-banner';
import { Spinner } from '../components/spinner';
import { ApiError, apiRequest, type User } from '../lib/api';

// The role names the Milestone 4 document uses
const ROLE_LABELS: Record<User['role'], string> = { user: 'Regular user', admin: 'Administrator' };

const STATUS_LABELS: Record<User['status'], string> = { active: 'Active', inactive: 'Inactive' };

// Screen 3 (user profile page). REQ-3.2.1 the logged-in user sees their own details
export function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ user: User }>('/api/users/me')
      .then((body) => setUser(body.user))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'));
  }, []);

  return (
    <section>
      <h1>Your profile</h1>
      {error && <ErrorBanner message={error} />}
      {!error && !user && <Spinner label="Loading your profile" />}
      {user && (
        <>
          <dl className="details">
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>First name</dt>
            <dd>{user.firstName}</dd>
            <dt>Last name</dt>
            <dd>{user.lastName}</dd>
            <dt>Member since</dt>
            <dd>
              <time dateTime={user.createdAt}>
                {new Date(user.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
            </dd>
            <dt>Role</dt>
            <dd>{ROLE_LABELS[user.role]}</dd>
            {/* REQ-3.2.5 spelled out in words, never by colour alone */}
            <dt>Account status</dt>
            <dd>{STATUS_LABELS[user.status]}</dd>
          </dl>
          {/* REQ-3.2.2 */}
          <p>
            <Link to="/profile/edit" className="button">
              Edit profile
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
