import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const sent = {
  status: 202,
  body: { message: 'If that email is registered, a reset link is on its way.' },
};

async function request(email: string) {
  await screen.findByRole('heading', { name: 'Forgot your password?' });
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
}

// REQ-3.1.6
describe('Forgot password page', () => {
  it('asks for a reset link and shows the server\'s confirmation', async () => {
    const fetchMock = mockFetch(signedOut, sent);
    renderApp('/forgot-password');

    await request('  Test@Test.com ');

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'If that email is registered, a reset link is on its way.',
    );
    const [path, init] = fetchMock.mock.calls[1];
    expect(path).toBe('/api/auth/forgot-password');
    expect(JSON.parse(init.body)).toEqual({ email: 'test@test.com' });
  });

  it('rejects a malformed email without calling the server', async () => {
    const fetchMock = mockFetch(signedOut);
    renderApp('/forgot-password');

    await request('test@invalid');

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email address.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('explains an unreachable server and keeps the form', async () => {
    mockFetch(signedOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/forgot-password');

    await request('test@test.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
    expect(screen.getByLabelText('Email')).toHaveValue('test@test.com');
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  });

  it('shows that it is working while the request is in flight', async () => {
    mockFetch(signedOut).mockReturnValueOnce(new Promise(() => {}));
    renderApp('/forgot-password');

    await request('test@test.com');

    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  });

  it('is reachable from the login page', async () => {
    mockFetch(signedOut);
    const router = renderApp('/login');

    await userEvent.click(await screen.findByRole('link', { name: 'Forgot your password?' }));

    expect(router.state.location.pathname).toBe('/forgot-password');
  });
});
