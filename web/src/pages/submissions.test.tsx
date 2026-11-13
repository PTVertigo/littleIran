import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const signedIn = {
  status: 200,
  body: {
    user: { id: '1', email: 'sara@example.com', firstName: 'Sara', lastName: 'Ahmadi', role: 'user', status: 'active', createdAt: '2026-10-01T12:00:00.000Z' },
  },
};
const base = { category: 'Restaurant', submittedAt: '2026-11-01T15:00:00.000Z', rejectionReason: null };
const lists = (businesses: object[], events: object[] = []) => ({ status: 200, body: { businesses, events } });
const categories = (type: string) => ({ status: 200, body: { categories: [{ id: '3', name: type === 'event' ? 'Festival' : 'Restaurant' }] } });

// REQ-3.6.1 to 3.6.3 member submissions
describe('My submissions page', () => {
  it('sends a visitor who is not logged in to log in', async () => {
    mockFetch(signedOut);
    const router = renderApp('/submissions');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('lists businesses and events with their status in words', async () => {
    const fetchMock = mockFetch(
      signedIn,
      lists(
        [{ ...base, id: '1', title: 'Saffron House', status: 'pending' }, { ...base, id: '2', title: 'Tehran Tea', status: 'approved' }],
        [{ ...base, id: '5', title: 'Nowruz Gala', category: 'Festival', status: 'pending' }],
      ),
    );
    renderApp('/submissions');

    expect(await screen.findByRole('heading', { level: 3, name: 'Saffron House' })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/submissions');
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('Status: Waiting for review');
    expect(cards[1]).toHaveTextContent('Status: Approved');
    expect(cards[2]).toHaveTextContent('Nowruz Gala');
    expect(screen.queryByRole('link', { name: /Edit and resubmit/ })).not.toBeInTheDocument();
  });

  it('shows the reason for a rejection and a link to edit and resubmit it', async () => {
    mockFetch(
      signedIn,
      lists(
        [{ ...base, id: '7', title: 'Saffron House', status: 'rejected', rejectionReason: 'Add opening hours.' }],
        [{ ...base, id: '9', title: 'Nowruz Gala', status: 'rejected', rejectionReason: 'Add the venue.' }],
      ),
    );
    renderApp('/submissions');

    const cards = await screen.findAllByRole('article');
    expect(cards[0]).toHaveTextContent('Status: Rejected');
    expect(cards[0]).toHaveTextContent('Reason: Add opening hours.');
    expect(screen.getByRole('link', { name: 'Edit and resubmit Saffron House' })).toHaveAttribute('href', '/businesses/new?resubmit=7');
    expect(screen.getByRole('link', { name: 'Edit and resubmit Nowruz Gala' })).toHaveAttribute('href', '/events/new?resubmit=9');
  });

  it('shows markup in a reason as plain text', async () => {
    mockFetch(signedIn, lists([{ ...base, id: '7', title: 'X', status: 'rejected', rejectionReason: '<b>bold</b>' }]));
    renderApp('/submissions');

    expect(await screen.findByText('Reason: <b>bold</b>')).toBeInTheDocument();
  });

  it('says so, with links to add one, when nothing was submitted', async () => {
    mockFetch(signedIn, lists([], []));
    renderApp('/submissions');

    expect(await screen.findByText(/You have not submitted anything yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a business' })).toHaveAttribute('href', '/businesses/new');
  });

  // REQ-4.2.1
  it('explains a failure in plain words', async () => {
    mockFetch(signedIn, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/submissions');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('is reached from the dashboard', async () => {
    mockFetch(signedIn, lists([]));
    renderApp('/dashboard');

    await userEvent.click(await screen.findByRole('link', { name: 'My submissions' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'My submissions' })).toBeInTheDocument();
  });
});

describe('Resubmitting a rejected business or event', () => {
  const previousBusiness = {
    status: 200,
    body: {
      business: {
        name: 'Saffron House', categoryId: '3', description: 'Tea and sweets', street: '1 Main St', city: 'Toronto', postalCode: 'M5V 2T6',
        phone: '4165550100', email: 'a@b.ca', website: '', rejectionReason: 'Add opening hours.', hours: [{ day: 2, opens: '10:00', closes: '18:00' }],
      },
    },
  };
  const previousEvent = {
    status: 200,
    body: {
      event: {
        title: 'Nowruz Gala', categoryId: '3', description: 'Celebrate', location: 'Hamilton', date: '2027-03-20', startTime: '18:00', endTime: '',
        organizerName: 'Org', organizerContact: 'org@x.ca', rejectionReason: 'Add the venue address.',
      },
    },
  };

  it('opens a rejected business filled in, with the reason, and sends it with PUT', async () => {
    const fetchMock = mockFetch(signedIn, categories('business'), previousBusiness, { status: 200, body: { business: { id: '7', name: 'Saffron House', status: 'pending' } } });
    renderApp('/businesses/new?resubmit=7');

    expect(await screen.findByRole('heading', { level: 1, name: 'Resubmit your business' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Saffron House')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Reason it was rejected: Add opening hours.');
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain('/api/submissions/businesses/7');
    expect(screen.getByRole('checkbox', { name: 'Tuesday is open' })).toBeChecked();
    expect(screen.getByLabelText('Tuesday opens')).toHaveValue('10:00');

    await userEvent.click(screen.getByRole('button', { name: 'Resubmit for review' }));

    expect(await screen.findByRole('heading', { name: 'Business resubmitted' })).toBeInTheDocument();
    const [path, init] = fetchMock.mock.calls[3];
    expect(path).toBe('/api/businesses/7');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toMatchObject({ name: 'Saffron House', hours: [{ day: 2, opens: '10:00', closes: '18:00' }] });
    expect(screen.getByRole('link', { name: 'See your submissions' })).toHaveAttribute('href', '/submissions');
  });

  it('opens a rejected event filled in, with the reason, and sends it with PUT', async () => {
    const fetchMock = mockFetch(signedIn, categories('event'), previousEvent, { status: 200, body: { event: { id: '9', title: 'Nowruz Gala', status: 'pending' } } });
    renderApp('/events/new?resubmit=9');

    expect(await screen.findByRole('heading', { level: 1, name: 'Resubmit your event' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Nowruz Gala')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Reason it was rejected: Add the venue address.');

    await userEvent.click(screen.getByRole('button', { name: 'Resubmit for review' }));

    expect(await screen.findByRole('heading', { name: 'Event resubmitted' })).toBeInTheDocument();
    const [path, init] = fetchMock.mock.calls[3];
    expect(path).toBe('/api/events/9');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toMatchObject({ title: 'Nowruz Gala', date: '2027-03-20', startTime: '18:00' });
  });

  it('says so when the submission cannot be resubmitted', async () => {
    mockFetch(signedIn, categories('event'), { status: 404, body: { error: 'Submission not found.' } });
    renderApp('/events/new?resubmit=9');

    expect(await screen.findByRole('alert')).toHaveTextContent('This event cannot be resubmitted. Only your own rejected events can.');
  });

  it('keeps the normal form, and POST, when there is nothing to resubmit', async () => {
    mockFetch(signedIn, categories('event'));
    renderApp('/events/new');

    expect(await screen.findByRole('heading', { level: 1, name: 'Add an event' })).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
