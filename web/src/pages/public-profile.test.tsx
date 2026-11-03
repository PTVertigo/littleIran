import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const me = {
  id: '1',
  email: 'vida@example.com',
  firstName: 'Vida',
  lastName: 'Viewer',
  role: 'user',
  status: 'active',
  createdAt: '2026-10-01T12:00:00.000Z',
};
const session = { status: 200, body: { user: me } };
const sara = { id: '2', firstName: 'Sara', lastName: 'Ahmadi', submissionCount: 3 };

// The value shown next to a label, e.g. "Submissions"
function valueOf(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;
}

// REQ-3.2.3
describe('Public profile page', () => {
  it('shows another member\'s name and how many submissions they made', async () => {
    const fetchMock = mockFetch(session, { status: 200, body: { user: sara } });
    renderApp('/users/2');

    expect(await screen.findByRole('heading', { level: 1, name: 'Sara Ahmadi' })).toBeInTheDocument();
    expect(valueOf('Submissions')).toHaveTextContent('3');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/users/2');
  });

  it('shows 0 for a member who has not submitted anything', async () => {
    mockFetch(session, { status: 200, body: { user: { ...sara, submissionCount: 0 } } });
    renderApp('/users/2');

    await screen.findByRole('heading', { name: 'Sara Ahmadi' });
    expect(valueOf('Submissions')).toHaveTextContent('0');
  });

  it('shows nothing private, because the page is only given the name and the count', async () => {
    mockFetch(session, { status: 200, body: { user: sara } });
    renderApp('/users/2');

    await screen.findByRole('heading', { name: 'Sara Ahmadi' });
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText('Role')).not.toBeInTheDocument();
    expect(screen.queryByText('Account status')).not.toBeInTheDocument();
  });

  // REQ-4.4.4
  it('shows a loading indicator until the profile arrives', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: me }) })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/users/2');

    expect(await screen.findByText('Loading the profile')).toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => ({ user: sara }) });
    expect(await screen.findByRole('heading', { name: 'Sara Ahmadi' })).toBeInTheDocument();
    expect(screen.queryByText('Loading the profile')).not.toBeInTheDocument();
  });

  it('says plainly when the member does not exist', async () => {
    mockFetch(session, { status: 404, body: { error: 'User not found.' } });
    renderApp('/users/999');

    expect(await screen.findByRole('heading', { level: 1, name: 'User not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });

  // REQ-4.2.1
  it('explains any other failure in plain words', async () => {
    mockFetch(session, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/users/2');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  // REQ-4.1.3
  it('shows a name containing markup as plain text', async () => {
    const hostile = { ...sara, firstName: "<script>alert('xss')</script>", lastName: '<img src=x onerror=alert(1)>' };
    mockFetch(session, { status: 200, body: { user: hostile } });
    renderApp('/users/2');

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: "<script>alert('xss')</script> <img src=x onerror=alert(1)>",
    });
    expect(heading).toBeInTheDocument();
    expect(document.body.querySelector('script')).toBeNull();
    expect(document.body.querySelector('img[onerror]')).toBeNull();
  });

  it('does not put a strange address straight into the request', async () => {
    const fetchMock = mockFetch(session, { status: 404, body: { error: 'User not found.' } });
    renderApp('/users/1%3Fx%3D1%2F..');

    await screen.findByRole('heading', { name: 'User not found' });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/users/1%3Fx%3D1%2F..');
  });

  it('sends a visitor who is not logged in to the login page', async () => {
    mockFetch({ status: 401, body: { error: 'Please log in to continue.' } });
    const router = renderApp('/users/2');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('is reached from your own profile', async () => {
    mockFetch(session, { status: 200, body: { user: me } }, { status: 200, body: { user: { ...sara, id: '1', firstName: 'Vida', lastName: 'Viewer' } } });
    renderApp('/profile');

    await userEvent.click(await screen.findByRole('link', { name: 'See how other members see your profile' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Vida Viewer' })).toBeInTheDocument();
  });
});
