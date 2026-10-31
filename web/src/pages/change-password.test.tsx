import { screen } from '@testing-library/react';
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
const loggedIn = { status: 200, body: { user } };
const changed = { status: 200, body: { message: 'Password updated.' } };

async function change(current: string, next: string) {
  await screen.findByRole('heading', { name: 'Change password' });
  if (current) await userEvent.type(screen.getByLabelText('Current password'), current);
  if (next) await userEvent.type(screen.getByLabelText('New password'), next);
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
}

// REQ-3.1.7
describe('Change password page', () => {
  it('changes the password with the current one and says so', async () => {
    const fetchMock = mockFetch(loggedIn, changed);
    renderApp('/change-password');

    await change('Test123@', 'NewPass1!');

    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been changed.');
    const [path, init] = fetchMock.mock.calls[1];
    expect(path).toBe('/api/auth/change-password');
    expect(JSON.parse(init.body)).toEqual({ currentPassword: 'Test123@', newPassword: 'NewPass1!' });
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });

  it('needs a logged-in user', async () => {
    mockFetch(signedOut);
    const router = renderApp('/change-password');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('asks for the current password without calling the server', async () => {
    const fetchMock = mockFetch(loggedIn);
    renderApp('/change-password');

    await change('', 'NewPass1!');

    expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription(
      'Enter your current password.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // REQ-3.1.3
  it('rejects a weak new password without calling the server and shows the rules', async () => {
    const fetchMock = mockFetch(loggedIn);
    renderApp('/change-password');

    await change('Test123@', 'weak');

    const field = screen.getByLabelText('New password');
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription(/8-72 characters/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects reusing the current password without calling the server', async () => {
    const fetchMock = mockFetch(loggedIn);
    renderApp('/change-password');

    await change('Test123@', 'Test123@');

    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
      /Choose a password you are not using now\./,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the server\'s answer when the current password is wrong and keeps the form', async () => {
    mockFetch(loggedIn, {
      status: 400,
      body: { errors: { currentPassword: 'Your current password is incorrect.' } },
    });
    renderApp('/change-password');

    await change('Wrong123@', 'NewPass1!');

    expect(await screen.findByLabelText('Current password')).toHaveAccessibleDescription(
      'Your current password is incorrect.',
    );
    expect(screen.getByLabelText('Current password')).toBeInvalid();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change password' })).toBeEnabled();
  });

  it('explains an unreachable server and keeps what was typed', async () => {
    mockFetch(loggedIn).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/change-password');

    await change('Test123@', 'NewPass1!');

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
    expect(screen.getByLabelText('Current password')).toHaveValue('Test123@');
  });

  it('shows that it is working while the request is in flight', async () => {
    mockFetch(loggedIn).mockReturnValueOnce(new Promise(() => {}));
    renderApp('/change-password');

    await change('Test123@', 'NewPass1!');

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('is reachable from the dashboard', async () => {
    mockFetch(loggedIn);
    const router = renderApp('/dashboard');

    await userEvent.click(await screen.findByRole('link', { name: 'Change password' }));

    expect(router.state.location.pathname).toBe('/change-password');
  });
});
