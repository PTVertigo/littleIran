import { Navigate, Outlet, useLocation } from 'react-router';

import { useSession } from '../lib/session';

export const AFTER_LOGIN_PATH = '/dashboard';

// Sends logged-out visitors to log in, remembering where they were headed
export function RequireAuth() {
  const { state } = useSession();
  const location = useLocation();

  if (state.status !== 'signedIn') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

// Login and registration make no sense once logged in
export function GuestOnly() {
  const { state } = useSession();

  if (state.status === 'signedIn') return <Navigate to={AFTER_LOGIN_PATH} replace />;
  return <Outlet />;
}

// REQ-3.8 administrator pages: logged-out visitors log in; a member who is not an administrator is told so
export function RequireAdmin() {
  const { state } = useSession();
  const location = useLocation();

  if (state.status !== 'signedIn') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (state.user.role !== 'admin') {
    return (
      <section>
        <h1>Not allowed</h1>
        <p>This page is only for administrators.</p>
      </section>
    );
  }
  return <Outlet />;
}
