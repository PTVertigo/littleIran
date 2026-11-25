import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const user = (role: 'user' | 'admin') => ({
  status: 200,
  body: { user: { id: '1', email: 'a@x.com', firstName: 'Ada', lastName: 'Admin', role, status: 'active', createdAt: '2026-10-01T12:00:00.000Z' } },
});
const who = { submitterId: '5', submitterName: 'Sara Ahmadi', submitterEmail: 'sara@example.com', submittedAt: '2026-11-01T15:00:00.000Z' };
const business = { ...who, id: '1', title: 'Saffron House', category: 'Restaurant', description: 'Tea and sweets', location: 'Toronto' };
const event = { ...who, id: '2', title: 'Nowruz Gala', category: 'Festival', description: 'Celebrate', location: 'Hamilton', startsAt: '2027-03-20T16:00:00.000Z', submitterName: null };
const pending = (businesses: object[] = [business], events: object[] = [event]) => ({ status: 200, body: { businesses, events } });

// REQ-3.8.1 to 3.8.5 administrator dashboard
describe('Admin page', () => {
  it('sends a visitor who is not logged in to log in', async () => {
    mockFetch(signedOut);
    const router = renderApp('/admin');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('tells a member who is not an administrator, and asks the server for nothing', async () => {
    const fetchMock = mockFetch(user('user'));
    renderApp('/admin');

    expect(await screen.findByRole('heading', { name: 'Not allowed' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('shows an Admin link to administrators only', async () => {
    mockFetch(user('admin'), pending());
    renderApp('/admin');

    expect(await screen.findByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('lists the pending businesses and events with who submitted them', async () => {
    const fetchMock = mockFetch(user('admin'), pending());
    renderApp('/admin');

    expect(await screen.findByRole('heading', { name: 'Pending submissions (2)' })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/submissions');
    const cards = screen.getAllByRole('article');
    expect(cards[0]).toHaveTextContent('Saffron House');
    expect(cards[0]).toHaveTextContent('Submitted by Sara Ahmadi (sara@example.com)');
    expect(cards[1]).toHaveTextContent('Nowruz Gala');
    expect(cards[1]).toHaveTextContent('Submitted by a former member');
  });

  it('says when nothing is waiting', async () => {
    mockFetch(user('admin'), pending([], []));
    renderApp('/admin');

    expect(await screen.findByText('Nothing is waiting for review.')).toBeInTheDocument();
  });

  it('approves a submission, removes it and announces it', async () => {
    const fetchMock = mockFetch(user('admin'), pending(), { status: 200, body: { business: { id: '1', status: 'approved' } } });
    renderApp('/admin');

    await userEvent.click(await screen.findByRole('button', { name: 'Approve Saffron House' }));

    expect(await screen.findByRole('heading', { name: 'Pending submissions (1)' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('“Saffron House” was approved.');
    expect(screen.queryByText('Tea and sweets')).not.toBeInTheDocument();
    const [path, init] = fetchMock.mock.calls[2];
    expect(path).toBe('/api/admin/businesses/1/approve');
    expect(init.method).toBe('POST');
  });

  it('rejects an event with the reason', async () => {
    const fetchMock = mockFetch(user('admin'), pending(), { status: 200, body: { event: { id: '2', status: 'rejected' } } });
    renderApp('/admin');

    const card = (await screen.findByRole('heading', { name: 'Nowruz Gala' })).closest('article')!;
    await userEvent.click(within(card).getByRole('button', { name: /^Reject Nowruz Gala/ }));
    await userEvent.type(screen.getByLabelText('Reason for rejecting “Nowruz Gala”'), '  Date is in the past.  ');
    await userEvent.click(screen.getByRole('button', { name: 'Reject Nowruz Gala' }));

    expect(await screen.findByRole('status')).toHaveTextContent('“Nowruz Gala” was rejected.');
    const [path, init] = fetchMock.mock.calls[2];
    expect(path).toBe('/api/admin/events/2/reject');
    expect(JSON.parse(init.body)).toEqual({ reason: 'Date is in the past.' });
  });

  it('will not reject without a reason, and sends nothing', async () => {
    const fetchMock = mockFetch(user('admin'), pending());
    renderApp('/admin');

    await userEvent.click(await screen.findByRole('button', { name: /^Reject Saffron House/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Reject Saffron House' }));

    expect(screen.getByLabelText('Reason for rejecting “Saffron House”')).toHaveAccessibleDescription(/Give the reason for the rejection\./);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('can cancel a rejection', async () => {
    mockFetch(user('admin'), pending());
    renderApp('/admin');

    await userEvent.click(await screen.findByRole('button', { name: /^Reject Saffron House/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Reason for rejecting “Saffron House”')).not.toBeInTheDocument();
  });

  it('shows the message of the server when a decision fails and keeps the submission', async () => {
    mockFetch(user('admin'), pending(), { status: 409, body: { error: 'This business has already been reviewed.' } });
    renderApp('/admin');

    await userEvent.click(await screen.findByRole('button', { name: 'Approve Saffron House' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This business has already been reviewed.');
    expect(screen.getByRole('heading', { name: 'Saffron House' })).toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a failure to load', async () => {
    mockFetch(user('admin'), { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/admin');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });
});
