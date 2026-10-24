import { createContext, useContext, useEffect, useState } from 'react';

import { ApiError, apiRequest, type User } from './api';

type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: User };

type SessionContextValue = {
  state: SessionState;
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

  return <SessionContext.Provider value={{ state }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
