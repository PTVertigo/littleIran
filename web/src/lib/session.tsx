import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest, type User } from './api';

type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: User };

type SessionContextValue = {
  state: SessionState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  // REQ-3.1.5 a returning visitor whose session cookie is still live stays logged in
  useEffect(() => {
    apiRequest<{ user: User }>('/api/auth/me')
      .then(({ user }) => setState({ status: 'signedIn', user }))
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) console.error(err);
        setState({ status: 'signedOut' });
      });
  }, []);

  // REQ-3.1.5 a tab left open can outlive its session (expiry, or a password reset ending every session).
  // Checking when the tab comes back into view notices that, and the check itself counts as activity.
  const signedIn = state.status === 'signedIn';
  useEffect(() => {
    if (!signedIn) return;
    function recheck() {
      if (document.visibilityState !== 'visible') return;
      apiRequest<{ user: User }>('/api/auth/me')
        .then(({ user }) => setState({ status: 'signedIn', user }))
        .catch((err) => {
          // Only a definite 401 ends the session here; being offline must not log anyone out
          if (err instanceof ApiError && err.status === 401) setState({ status: 'signedOut' });
        });
    }
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
  }, [signedIn]);

  // REQ-3.1.4 the server sets the session cookie; only the user comes back in the body
  const signIn = useCallback(async (email: string, password: string) => {
    const { user } = await apiRequest<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setState({ status: 'signedIn', user });
  }, []);

  // REQ-3.1.8 only the server can clear the HttpOnly cookie, so a failed request is not a logout.
  // A 401 means the session had already ended, which is the outcome we wanted anyway.
  const signOut = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch((err) => {
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    });
    setState({ status: 'signedOut' });
  }, []);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
