import { screen, waitFor, within } from '@testing-library/react';
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

async function fillAndSubmit(email: string, password: string) {
  const form = await screen.findByRole('heading', { name: 'Log in' });
  expect(form).toBeVisible();
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  // REQ-4.3.2 Enter submits the form, no mouse needed
  await userEvent.keyboard('{Enter}');
}

describe('Login page', () => {
  // FE-001 (REQ-3.1.4, 3.1.5)
  it('logs in with valid credentials and goes to the dashboard', async () => {
    const fetchMock = mockFetch(signedOut, loggedIn);
    renderApp('/login');

    await fillAndSubmit('test@test.com', 'Test123@');

    expect(await screen.findByRole('heading', { name: 'Welcome, Sara' })).toBeVisible();
    const [path, init] = fetchMock.mock.calls[1];
    expect(path).toBe('/api/auth/login');
    expect(JSON.parse(init.body)).toEqual({ email: 'test@test.com', password: 'Test123@' });
  });

  // FE-002 (REQ-3.1.4)
  it('shows Invalid credentials for a wrong password and stays on the page', async () => {
    mockFetch(signedOut, { status: 401, body: { error: 'Invalid credentials' } });
    renderApp('/login');

    await fillAndSubmit('test@test.com', 'Wrong123@');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });

  // REQ-3.1.4 the page never reveals whether an email is registered
  it('shows the same message for an unknown email as for a wrong password', async () => {
    mockFetch(signedOut, { status: 401, body: { error: 'Invalid credentials' } });
    renderApp('/login');

    await fillAndSubmit('nobody@example.com', 'Test123@');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  it('trims spaces around the email before sending it', async () => {
    const fetchMock = mockFetch(signedOut, loggedIn);
    renderApp('/login');

    await fillAndSubmit('  test@test.com ', 'Test123@');

    await screen.findByRole('heading', { name: 'Welcome, Sara' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).email).toBe('test@test.com');
  });

  it('explains an unreachable server and keeps what was typed', async () => {
    mockFetch(signedOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/login');

    await fillAndSubmit('test@test.com', 'Test123@');

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
    expect(screen.getByLabelText('Email')).toHaveValue('test@test.com');
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });

  // REQ-3.1.9
  it('explains a locked account', async () => {
    mockFetch(signedOut, {
      status: 423,
      body: { error: 'Too many failed attempts. Try again in 30 minutes.' },
    });
    renderApp('/login');

    await fillAndSubmit('test@test.com', 'Wrong123@');

    expect(await screen.findByRole('alert')).toHaveTextContent(/try again in 30 minutes/i);
  });

  // REQ-3.1.9 the page just relays what the server decides, attempt after attempt
  it('shows Invalid credentials until the server locks the account, then keeps refusing', async () => {
    const locked = { status: 423, body: { error: 'Too many failed attempts. Try again in 30 minutes.' } };
    const invalid = { status: 401, body: { error: 'Invalid credentials' } };
    mockFetch(signedOut, invalid, invalid, locked, locked);
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Log in' });
    await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Wrong123@');
    const submitButton = screen.getByRole('button', { name: 'Log in' });

    await userEvent.click(submitButton);
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    await userEvent.click(submitButton);
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');

    await userEvent.click(submitButton);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again in 30 minutes/i));

    // Even the right password is refused while locked
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'Test123@');
    await userEvent.click(submitButton);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again in 30 minutes/i));
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  // REQ-4.1.7 client-side check before anything is sent
  it('asks for both fields without calling the server', async () => {
    const fetchMock = mockFetch(signedOut);
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Log in' });

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email and password.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // REQ-4.4.4
  it('shows that it is working while the request is in flight', async () => {
    const fetchMock = mockFetch(signedOut);
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    renderApp('/login');

    await fillAndSubmit('test@test.com', 'Test123@');

    expect(screen.getByRole('button', { name: 'Logging in…' })).toBeDisabled();
  });

  it('shows and hides the password on request', async () => {
    mockFetch(signedOut);
    renderApp('/login');
    const password = await screen.findByLabelText('Password');

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });
});

describe('Pages that need a login', () => {
  it('send a logged-out visitor to log in, then back where they were headed', async () => {
    mockFetch(signedOut, loggedIn);
    const router = renderApp('/dashboard');

    await fillAndSubmit('test@test.com', 'Test123@');

    expect(await screen.findByRole('heading', { name: 'Welcome, Sara' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('skip the login page for someone already logged in', async () => {
    mockFetch(loggedIn);
    const router = renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Welcome, Sara' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/dashboard');
  });
});

// REQ-3.1.8
describe('Logging out', () => {
  it('ends the session and shows the logged-out navigation', async () => {
    const fetchMock = mockFetch(loggedIn, { status: 204 });
    const router = renderApp('/dashboard');
    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));

    await userEvent.click(await nav.findByRole('button', { name: 'Log out' }));

    expect(await nav.findByRole('link', { name: 'Log in' })).toBeVisible();
    expect(nav.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/logout');
    expect(router.state.location.pathname).toBe('/');
  });

  it('works from any page that needs a login and lands on the home page', async () => {
    mockFetch(loggedIn, { status: 204 });
    const router = renderApp('/change-password');
    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));

    await userEvent.click(await nav.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'LittleIran' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
  });

  it('locks the pages that need a login again', async () => {
    mockFetch(loggedIn, { status: 204 });
    const router = renderApp('/dashboard');
    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));
    await userEvent.click(await nav.findByRole('button', { name: 'Log out' }));
    await nav.findByRole('link', { name: 'Log in' });

    await router.navigate('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('still logs out here when the server says the session had already ended', async () => {
    mockFetch(loggedIn, signedOut);
    renderApp('/dashboard');
    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));

    await userEvent.click(await nav.findByRole('button', { name: 'Log out' }));

    expect(await nav.findByRole('link', { name: 'Log in' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stays logged in and says so when the server cannot be reached', async () => {
    mockFetch(loggedIn).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/dashboard');
    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));

    await userEvent.click(await nav.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
    expect(nav.getByRole('button', { name: 'Log out' })).toBeVisible();
  });
});
