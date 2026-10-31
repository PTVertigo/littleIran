import { act, screen } from '@testing-library/react';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const user = {
  id: '1',
  email: 'test@test.com',
  firstName: 'Sara',
  lastName: 'Ahmadi',
  role: 'user',
  createdAt: '2026-10-01T00:00:00.000Z',
};
const loggedIn = { status: 200, body: { user } };

function setTabVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

function showTab() {
  act(() => {
    setTabVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

afterEach(() => setTabVisibility('visible'));

// REQ-3.1.5
describe('Session', () => {
  it('keeps a returning visitor logged in while their session cookie is live', async () => {
    const fetchMock = mockFetch(loggedIn);
    renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Welcome, Sara' })).toBeVisible();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/me');
  });

  it('checks the session again when the tab comes back into view and stays logged in', async () => {
    const fetchMock = mockFetch(loggedIn, loggedIn);
    renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Welcome, Sara' });

    showTab();

    await screen.findByRole('heading', { name: 'Welcome, Sara' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/me');
  });

  it('sends the visitor to log in when the session ended while the tab was away', async () => {
    mockFetch(loggedIn, signedOut);
    const router = renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Welcome, Sara' });

    showTab();

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('does not log anyone out because the server could not be reached', async () => {
    mockFetch(loggedIn).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Welcome, Sara' });

    showTab();

    expect(screen.getByRole('heading', { name: 'Welcome, Sara' })).toBeVisible();
  });

  it('does not check while the tab is hidden', async () => {
    const fetchMock = mockFetch(loggedIn);
    renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Welcome, Sara' });

    act(() => {
      setTabVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not check at all for a visitor who is logged out', async () => {
    const fetchMock = mockFetch(signedOut);
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Log in' });

    showTab();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
