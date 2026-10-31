import { Link } from 'react-router';

import { useSession } from '../lib/session';

// Screen 2 (home/dashboard). Only reachable through RequireAuth, so the user is always there
export function DashboardPage() {
  const { state } = useSession();
  if (state.status !== 'signedIn') return null;

  return (
    <section>
      <h1>Welcome, {state.user.firstName}</h1>
      <p className="muted">You are logged in as {state.user.email}.</p>
      <p>
        <Link to="/change-password">Change password</Link>
      </p>
    </section>
  );
}
