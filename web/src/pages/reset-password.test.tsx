import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
const updated = { status: 200, body: { message: 'Password updated. You can now log in.' } };

async function choose(password: string) {
  await screen.findByRole('heading', { name: 'Choose a new password' });
  await userEvent.type(screen.getByLabelText('New password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
}

// REQ-3.1.6
describe('Reset password page', () => {
  it('sets the new password using the token from the link', async () => {
    const fetchMock = mockFetch(signedOut, updated);
    renderApp('/reset-password?token=abc123');

    await choose('NewPass1!');

    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeVisible();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    );
    const [path, init] = fetchMock.mock.calls[1];
    expect(path).toBe('/api/auth/reset-password');
    expect(JSON.parse(init.body)).toEqual({ token: 'abc123', password: 'NewPass1!' });
  });

  // REQ-3.1.3
  it('rejects a weak password without using up the link', async () => {
    const fetchMock = mockFetch(signedOut);
    renderApp('/reset-password?token=abc123');

    await choose('weak');

    expect(screen.getByLabelText('New password')).toBeInvalid();
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(/8-72 characters/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('offers a new link when this one is invalid or has expired', async () => {
    mockFetch(signedOut, {
      status: 400,
      body: { error: 'This reset link is invalid or has expired.' },
    });
    renderApp('/reset-password?token=old');

    await choose('NewPass1!');

    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.');
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('explains a link that has no token and offers a new one', async () => {
    const fetchMock = mockFetch(signedOut);
    renderApp('/reset-password');

    expect(await screen.findByRole('heading', { name: 'Reset link not valid' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('can be opened by someone who is already logged in', async () => {
    mockFetch({ status: 200, body: { user } });
    const router = renderApp('/reset-password?token=abc123');

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/reset-password');
  });

  it('shows that it is working while the request is in flight', async () => {
    mockFetch(signedOut).mockReturnValueOnce(new Promise(() => {}));
    renderApp('/reset-password?token=abc123');

    await choose('NewPass1!');

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });
});
