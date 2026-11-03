import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const norouz = {
  id: '1',
  title: 'Norouz Festival',
  category: 'Festival',
  startsAt: '2026-12-12T16:00:00.000Z', // 11:00 AM in Ontario
  location: 'Hamilton Convention Centre, Hamilton',
  description: 'Haft-sin tables and live music.',
  past: false,
};
const yalda = { ...norouz, id: '2', title: 'Yalda Night', category: 'Celebration', startsAt: '2026-12-21T00:30:00.000Z', description: 'Poetry.' };
const old = { ...norouz, id: '3', title: 'Mehregan Festival', startsAt: '2026-06-01T16:00:00.000Z', past: true };
const found = (events: object[]) => ({ status: 200, body: { events } });

// REQ-3.4.1
describe('Events page', () => {
  it('lists every event with its title, category, date and time, location and description', async () => {
    const fetchMock = mockFetch(signedOut, found([norouz, yalda]));
    renderApp('/events');

    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('heading', { level: 2, name: 'Norouz Festival' })).toBeInTheDocument();
    expect(within(cards[0]).getByText('Festival')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Sat, December 12, 2026, 11:00 AM')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Hamilton Convention Centre, Hamilton')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Haft-sin tables and live music.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/events');
  });

  it('writes the time in Ontario time, even when the day is different in UTC', async () => {
    mockFetch(signedOut, found([yalda]));
    renderApp('/events');

    // 00:30 UTC on the 21st is 7:30 PM on the 20th in Ontario
    expect(await screen.findByText('Sun, December 20, 2026, 7:30 PM')).toBeInTheDocument();
  });

  it('marks the date as a time element a machine can read', async () => {
    mockFetch(signedOut, found([norouz]));
    renderApp('/events');

    const time = await screen.findByText('Sat, December 12, 2026, 11:00 AM');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', '2026-12-12T16:00:00.000Z');
  });

  it('keeps the order the server sent, and says which events are over', async () => {
    mockFetch(signedOut, found([norouz, old]));
    renderApp('/events');

    const cards = await screen.findAllByRole('article');
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['Norouz Festival', 'Mehregan Festival']);
    expect(within(cards[0]).queryByText(/Past event/)).not.toBeInTheDocument();
    expect(within(cards[1]).getByText('Festival · Past event')).toBeInTheDocument();
  });

  it('announces how many events there are', async () => {
    mockFetch(signedOut, found([norouz, yalda]));
    renderApp('/events');

    expect(await screen.findByText('2 events')).toHaveAttribute('role', 'status');
  });

  it('says "1 event" for a single event', async () => {
    mockFetch(signedOut, found([norouz]));
    renderApp('/events');

    expect(await screen.findByText('1 event')).toBeInTheDocument();
  });

  it('says so when there are no events yet', async () => {
    mockFetch(signedOut, found([]));
    renderApp('/events');

    expect(await screen.findByText('No events have been listed yet.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  // REQ-4.4.4
  it('shows a loading indicator until the events arrive', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => signedOut.body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/events');

    expect(await screen.findByText('Loading events')).toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => ({ events: [norouz] }) });
    expect(await screen.findByRole('article')).toBeInTheDocument();
    expect(screen.queryByText('Loading events')).not.toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a failure in plain words', async () => {
    mockFetch(signedOut, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/events');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  // REQ-4.1.3
  it('shows a title and description containing markup as plain text', async () => {
    mockFetch(signedOut, found([{ ...norouz, title: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>' }]));
    renderApp('/events');

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '<script>alert(1)</script>' })).toBeInTheDocument();
    expect(document.body.querySelector('script')).toBeNull();
    expect(document.body.querySelector('img[onerror]')).toBeNull();
  });

  it('is open to a visitor who is not logged in', async () => {
    mockFetch(signedOut, found([norouz]));
    const router = renderApp('/events');

    await screen.findByRole('article');
    expect(router.state.location.pathname).toBe('/events');
  });

  // REQ-4.4.2 reachable in one click
  it('is reached from the navigation and from the home page button', async () => {
    mockFetch(signedOut, found([norouz]), found([norouz]));
    renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: 'Browse events' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Cultural events' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Events' })).toHaveAttribute('aria-current', 'page');
  });

  it('has one main heading, and a heading for each event below it', async () => {
    mockFetch(signedOut, found([norouz, yalda]));
    renderApp('/events');

    await screen.findAllByRole('article');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
  });
});
