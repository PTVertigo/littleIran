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
