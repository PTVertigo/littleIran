import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const user = {
  id: '1',
  email: 'sara@example.com',
  firstName: 'Sara',
  lastName: 'Ahmadi',
  role: 'user',
  status: 'active',
  createdAt: '2026-10-01T12:00:00.000Z',
};
const session = { status: 200, body: { user } };

// The value shown next to a label, e.g. "Email"
function valueOf(label: string) {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.nextElementSibling as HTMLElement;
}

// REQ-3.2.1
describe('Profile page', () => {
  it('shows the email, names, registration date and role', async () => {
    mockFetch(session, { status: 200, body: { user } });
    renderApp('/profile');

    await screen.findByRole('heading', { level: 1, name: 'Your profile' });
    expect(await screen.findByText('sara@example.com')).toBeInTheDocument();
    expect(valueOf('Email')).toHaveTextContent('sara@example.com');
    expect(valueOf('First name')).toHaveTextContent('Sara');
    expect(valueOf('Last name')).toHaveTextContent('Ahmadi');
    expect(valueOf('Member since')).toHaveTextContent('October 1, 2026');
    expect(valueOf('Role')).toHaveTextContent('Regular user');
  });

  // REQ-3.2.5
  it('says in words that the account is active', async () => {
    mockFetch(session, { status: 200, body: { user } });
    renderApp('/profile');

    await screen.findByText('sara@example.com');
    expect(valueOf('Account status')).toHaveTextContent('Active');
  });

  it('says in words that the account is inactive', async () => {
    const inactive = { ...user, status: 'inactive' };
    mockFetch({ status: 200, body: { user: inactive } }, { status: 200, body: { user: inactive } });
    renderApp('/profile');

    await screen.findByText('sara@example.com');
    expect(valueOf('Account status')).toHaveTextContent('Inactive');
  });

  it('marks the registration date for machines as well', async () => {
    mockFetch(session, { status: 200, body: { user } });
    renderApp('/profile');

    await screen.findByText('October 1, 2026');
    expect(screen.getByText('October 1, 2026')).toHaveAttribute('datetime', user.createdAt);
  });

  it('names the role Administrator for an administrator', async () => {
    const admin = { ...user, role: 'admin' };
    mockFetch({ status: 200, body: { user: admin } }, { status: 200, body: { user: admin } });
    renderApp('/profile');

    await screen.findByText('sara@example.com');
    expect(valueOf('Role')).toHaveTextContent('Administrator');
  });

  // REQ-4.4.4
  it('shows a loading indicator until the profile arrives', async () => {
    let finish: (value: object) => void = () => {};
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user }) })
      .mockReturnValueOnce(pending);
    renderApp('/profile');

    // The app's own session check shows a spinner first; this is the profile's
    expect(await screen.findByText('Loading your profile')).toBeInTheDocument();
    expect(screen.queryByText('sara@example.com')).not.toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => ({ user }) });
    expect(await screen.findByText('sara@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a failure in plain words', async () => {
    mockFetch(session, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/profile');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.queryByRole('definition')).not.toBeInTheDocument();
  });

  // REQ-4.1.3
  it('shows a name containing markup as plain text', async () => {
    const hostile = { ...user, firstName: "<script>alert('xss')</script>", lastName: '<img src=x onerror=alert(1)>' };
    mockFetch({ status: 200, body: { user: hostile } }, { status: 200, body: { user: hostile } });
    renderApp('/profile');

    await screen.findByText('sara@example.com');
    expect(valueOf('First name')).toHaveTextContent("<script>alert('xss')</script>");
    expect(document.body.querySelector('script')).toBeNull();
    expect(document.body.querySelector('img[onerror]')).toBeNull();
  });

  it('sends a visitor who is not logged in to the login page', async () => {
    mockFetch({ status: 401, body: { error: 'Please log in to continue.' } });
    const router = renderApp('/profile');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
  });

  // REQ-4.4.2 reachable from the navigation on every page
  it('is one click away from the dashboard through the navigation', async () => {
    mockFetch(session, { status: 200, body: { user } });
    renderApp('/dashboard');

    await screen.findByRole('heading', { name: /Welcome/ });
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Profile' }));

    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeInTheDocument();
  });
});
