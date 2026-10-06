import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest, type User } from '@/lib/api';

const TOKEN_KEY = 'session_token';

type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: User };

type SessionContextValue = {
  state: SessionState;
  signIn: (email: string, password: string) => Promise<void>;
  register: (details: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  // Calls the API as the signed-in user; an expired session signs them out
  authedRequest: <T>(path: string, options?: { method?: 'GET' | 'POST'; body?: object }) => Promise<T>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [token, setToken] = useState<string | null>(null);

  const startSession = useCallback(async (newToken: string, user: User) => {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setToken(newToken);
    setState({ status: 'signedIn', user });
  }, []);

  const endSession = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setState({ status: 'signedOut' });
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!stored) {
        setState({ status: 'signedOut' });
        return;
      }
      try {
        const { user } = await apiRequest<{ user: User }>('/api/auth/me', { token: stored });
        setToken(stored);
        setState({ status: 'signedIn', user });
      } catch (err) {
        // Only a rejected token ends the session; being offline at launch keeps it for next time
        if (err instanceof ApiError && err.status === 401) await endSession();
        else setState({ status: 'signedOut' });
      }
    })();
  }, [endSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      await startSession(data.token, data.user);
    },
    [startSession],
  );

  const register = useCallback(
    async (details: { email: string; password: string; firstName: string; lastName: string }) => {
      await apiRequest('/api/users', { method: 'POST', body: details });
      await signIn(details.email, details.password);
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    // Logging out must work locally even when the server cannot be reached
    await apiRequest('/api/auth/logout', { method: 'POST', token }).catch(() => {});
    await endSession();
  }, [token, endSession]);

  const authedRequest = useCallback(
    async <T,>(path: string, options: { method?: 'GET' | 'POST'; body?: object } = {}) => {
      try {
        return await apiRequest<T>(path, { ...options, token });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) await endSession();
        throw err;
      }
    },
    [token, endSession],
  );

  const value = useMemo(
    () => ({ state, signIn, register, signOut, authedRequest }),
    [state, signIn, register, signOut, authedRequest],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
