import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const user = {
  id: '2',
  email: 'sara@example.com',
  firstName: 'Sara',
  lastName: 'Ahmadi',
  role: 'user',
  createdAt: '2026-10-01T00:00:00.000Z',
};
const registered = { status: 201, body: user };
const loggedIn = { status: 200, body: { user } };

async function fillForm(overrides: Partial<Record<string, string>> = {}) {
  const values = {
    'First name': 'Sara',
    'Last name': 'Ahmadi',
    Email: 'sara@example.com',
    Password: 'Strong1!',
    ...overrides,
  };
  await screen.findByRole('heading', { name: 'Create an account' });
  for (const [label, value] of Object.entries(values)) {
    if (value) await userEvent.type(screen.getByLabelText(label), value);
  }
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Create account' }));

// REQ-3.1.1
describe('Register page', () => {
  it('creates the account, logs in and goes to the dashboard', async () => {
    const fetchMock = mockFetch(signedOut, registered, loggedIn);
    const router = renderApp('/register');

    await fillForm({ Email: '  Sara@Example.com ' });
    await submit();

    expect(await screen.findByRole('heading', { name: 'Welcome, Sara' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/dashboard');
    const [createPath, createInit] = fetchMock.mock.calls[1];
    expect(createPath).toBe('/api/users');
    expect(JSON.parse(createInit.body)).toEqual({
      firstName: 'Sara',
      lastName: 'Ahmadi',
      email: 'sara@example.com',
      password: 'Strong1!',
    });
    expect(fetchMock.mock.calls[2][0]).toBe('/api/auth/login');
  });

  it('asks for every missing field without calling the server', async () => {
    const fetchMock = mockFetch(signedOut);
    renderApp('/register');

    await fillForm({ 'First name': '', 'Last name': '', Email: '', Password: '' });
    await submit();

    expect(screen.getByLabelText('First name')).toHaveAccessibleDescription('Enter your first name.');
    expect(screen.getByLabelText('Last name')).toHaveAccessibleDescription('Enter your last name.');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/Enter a password\.$/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // REQ-3.1.3
  it('states the password rules next to the field', async () => {
    mockFetch(signedOut);
    renderApp('/register');
    await screen.findByRole('heading', { name: 'Create an account' });

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/8-72 characters/);
  });

  // REQ-3.1.3
  it('rejects a weak password without calling the server and keeps the rules visible', async () => {
    const fetchMock = mockFetch(signedOut);
    renderApp('/register');

    await fillForm({ Password: 'weak' });
    await submit();

    const password = screen.getByLabelText('Password');
    expect(password).toBeInvalid();
    expect(password).toHaveAccessibleDescription(/8-72 characters.*8-72 characters/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // REQ-3.1.2
  it('rejects a malformed email without calling the server', async () => {
    const fetchMock = mockFetch(signedOut);
    renderApp('/register');

    await fillForm({ Email: 'test@invalid' });
    await submit();

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email address.');
    expect(screen.getByLabelText('Email')).toBeInvalid();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // REQ-3.1.2
  it('says so under the email field when the address is already registered', async () => {
    mockFetch(signedOut, {
      status: 409,
      body: { errors: { email: 'That email is already registered.' } },
    });
    const router = renderApp('/register');

    await fillForm();
    await submit();

    expect(await screen.findByLabelText('Email')).toHaveAccessibleDescription(
      'That email is already registered.',
    );
    expect(screen.getByLabelText('Email')).toBeInvalid();
    expect(router.state.location.pathname).toBe('/register');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  });

  it('shows the server\'s message under the field it belongs to and keeps what was typed', async () => {
    mockFetch(signedOut, { status: 400, body: { errors: { firstName: 'Enter your first name.' } } });
    const router = renderApp('/register');

    await fillForm();
    await submit();

    expect(await screen.findByLabelText('First name')).toBeInvalid();
    expect(screen.getByLabelText('Last name')).toHaveValue('Ahmadi');
    expect(router.state.location.pathname).toBe('/register');
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  });

  it('explains an unreachable server and keeps what was typed', async () => {
    mockFetch(signedOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/register');

    await fillForm();
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
    expect(screen.getByLabelText('First name')).toHaveValue('Sara');
  });

  it('sends the person to log in if the automatic login fails after sign-up', async () => {
    mockFetch(signedOut, registered, { status: 500, body: {} });
    const router = renderApp('/register');

    await fillForm();
    await submit();

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows that it is working while the request is in flight', async () => {
    const fetchMock = mockFetch(signedOut);
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    renderApp('/register');

    await fillForm();
    await submit();

    expect(screen.getByRole('button', { name: 'Creating account…' })).toBeDisabled();
  });

  it('is reachable from the login page and from the navigation', async () => {
    mockFetch(signedOut, signedOut);
    const router = renderApp('/login');

    await userEvent.click(await screen.findByRole('link', { name: 'Create an account' }));
    expect(router.state.location.pathname).toBe('/register');

    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    await userEvent.click(nav.getByRole('link', { name: 'Log in' }));
    expect(router.state.location.pathname).toBe('/login');
    await userEvent.click(nav.getByRole('link', { name: 'Sign up' }));
    expect(router.state.location.pathname).toBe('/register');
  });
});
