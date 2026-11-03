import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { eventPage, mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const event = {
  id: '4',
  title: 'Norouz Festival',
  category: 'Festival',
  description: 'Haft-sin tables and live music.',
  location: 'Hamilton Convention Centre, 1 Sample Street, Hamilton',
  startsAt: '2026-12-12T16:00:00.000Z', // 11:00 AM in Ontario
  endsAt: '2026-12-13T00:00:00.000Z', // 7:00 PM, the same day in Ontario
  organizerName: 'Hamilton Iranian Association',
  organizerContact: 'hello@hamilton-iranian.example.com',
  past: false,
};
const found = (overrides: object = {}) => ({ status: 200, body: { event: { ...event, ...overrides } } });

async function openEvent(overrides: object = {}) {
  const fetchMock = mockFetch(signedOut, found(overrides));
  renderApp('/events/4');
  await screen.findByRole('heading', { level: 1 });
  await screen.findByText(/Date and time/);
  return fetchMock;
}

const valueOf = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

// REQ-3.4.2
describe('Event detail page', () => {
  it('shows the title, category and description', async () => {
    const fetchMock = await openEvent();

    expect(screen.getByRole('heading', { level: 1, name: 'Norouz Festival' })).toBeInTheDocument();
    expect(screen.getByText('Festival')).toBeInTheDocument();
    expect(screen.getByText('Haft-sin tables and live music.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/events/4');
  });

  it('shows the date and time, as a range when it ends the same day', async () => {
    await openEvent();

    expect(valueOf('Date and time')).toHaveTextContent('Sat, December 12, 2026, 11:00 AM – 7:00 PM');
    const time = within(valueOf('Date and time')).getByText(/December 12/);
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', '2026-12-12T16:00:00.000Z');
  });

  it('writes both days when it ends on another day', async () => {
    await openEvent({ endsAt: '2026-12-14T02:00:00.000Z' });

    expect(valueOf('Date and time')).toHaveTextContent('Sat, December 12, 2026, 11:00 AM to Sun, December 13, 2026, 9:00 PM');
  });

  it('shows only the start when there is no end time', async () => {
    await openEvent({ endsAt: null });

    expect(valueOf('Date and time')).toHaveTextContent(/^Sat, December 12, 2026, 11:00 AM$/);
  });

  it('shows the location', async () => {
    await openEvent();

    expect(valueOf('Location')).toHaveTextContent('Hamilton Convention Centre, 1 Sample Street, Hamilton');
  });

  it('shows the organizer name, and an email contact as a link', async () => {
    await openEvent();

    expect(screen.getByRole('heading', { level: 2, name: 'Organizer' })).toBeInTheDocument();
    expect(valueOf('Name')).toHaveTextContent('Hamilton Iranian Association');
    expect(within(valueOf('Contact')).getByRole('link')).toHaveAttribute('href', 'mailto:hello@hamilton-iranian.example.com');
  });

  it.each(['905-555-0101', 'Ask at the door', 'javascript:alert(1)', '<a href="x">x</a>', 'a@b', 'two words@example.com'])(
    'shows the contact %p as plain text, not a link',
    async (organizerContact) => {
      await openEvent({ organizerContact });

      expect(valueOf('Contact')).toHaveTextContent(organizerContact);
      expect(within(valueOf('Contact')).queryByRole('link')).not.toBeInTheDocument();
    },
  );

  it('says when the event is over', async () => {
    await openEvent({ past: true });

    expect(screen.getByText('Festival · Past event')).toBeInTheDocument();
  });

  it('does not say "Past event" for an event still to come', async () => {
    await openEvent();

    expect(screen.queryByText(/Past event/)).not.toBeInTheDocument();
  });

  it('shows text containing markup as plain text', async () => {
    await openEvent({ title: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>', organizerName: '<b>Bold</b>' });

    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText('<b>Bold</b>')).toBeInTheDocument();
    expect(document.body.querySelector('script')).toBeNull();
    expect(document.body.querySelector('img[onerror]')).toBeNull();
    expect(document.body.querySelector('main b')).toBeNull();
  });

  it('has a way back to the events', async () => {
    await openEvent();

    expect(screen.getByRole('link', { name: 'Back to the events' })).toHaveAttribute('href', '/events');
  });

  it('is open to a visitor who is not logged in', async () => {
    mockFetch(signedOut, found());
    const router = renderApp('/events/4');

    await screen.findByRole('heading', { level: 1, name: 'Norouz Festival' });
    expect(router.state.location.pathname).toBe('/events/4');
  });

  // REQ-4.4.4
  it('shows a loading indicator until the event arrives', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => signedOut.body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/events/4');

    expect(await screen.findByText('Loading the event')).toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => ({ event }) });
    expect(await screen.findByRole('heading', { level: 1, name: 'Norouz Festival' })).toBeInTheDocument();
    expect(screen.queryByText('Loading the event')).not.toBeInTheDocument();
  });

  it('says plainly when the event does not exist or is not published', async () => {
    mockFetch(signedOut, { status: 404, body: { error: 'Event not found.' } });
    renderApp('/events/999');

    expect(await screen.findByRole('heading', { level: 1, name: 'Event not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the events' })).toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains any other failure in plain words', async () => {
    mockFetch(signedOut, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/events/4');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('is reached by clicking an event in the list, and the way back returns to the list', async () => {
    const summary = { id: '4', title: 'Norouz Festival', category: 'Festival', startsAt: event.startsAt, location: event.location, description: 'Music.', past: false };
    mockFetch(
      signedOut,
      { status: 200, body: { categories: [{ id: '1', name: 'Festival' }] } },
      { status: 200, body: eventPage([summary]) },
      found(),
      { status: 200, body: { categories: [{ id: '1', name: 'Festival' }] } },
      { status: 200, body: eventPage([summary]) },
    );
    renderApp('/events');

    await userEvent.click(await screen.findByRole('link', { name: 'Norouz Festival' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Organizer' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Back to the events' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Cultural events' })).toBeInTheDocument();
  });
});
