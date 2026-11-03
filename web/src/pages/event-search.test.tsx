import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { eventPage, mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const base = { startsAt: '2026-12-12T16:00:00.000Z', location: 'Hamilton', past: false };
const norouz = { ...base, id: '1', title: 'Norouz Festival', category: 'Festival', description: 'New Year.' };
const calligraphy = { ...base, id: '2', title: 'Persian Calligraphy Workshop', category: 'Workshop', description: 'Ink.' };
const film = { ...base, id: '3', title: 'Persian Film Night', category: 'Cultural Events', description: 'Film.' };
const filterCategories = {
  status: 200,
  body: { categories: [{ id: '1', name: 'Festival' }, { id: '2', name: 'Workshop' }, { id: '3', name: 'Cultural Events' }] },
};
const all = (events = [norouz, calligraphy, film]) => ({ status: 200, body: eventPage(events) });

const box = () => screen.getByRole('searchbox', { name: 'Search events' });
const searchFor = async (text: string) => {
  await userEvent.clear(box());
  if (text) await userEvent.type(box(), text);
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
};

// REQ-3.7.2
describe('Searching the events', () => {
  it('has a search box in a search landmark, with a hint', async () => {
    mockFetch(signedOut, filterCategories, all());
    renderApp('/events');

    await screen.findAllByRole('article');
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(box()).toHaveAccessibleDescription('By name or category, for example “Persian workshop”.');
    expect(box()).toHaveAttribute('maxlength', '100');
    expect(box()).toHaveValue('');
  });

  it('shows the matching events with their basic information', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all(), all([calligraphy, film]));
    renderApp('/events');
    await screen.findAllByRole('article');

    await searchFor('Persian');

    await screen.findByText('2 events found for “Persian”');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/events?search=Persian');
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Persian Calligraphy Workshop');
    expect(cards[0]).toHaveTextContent('Workshop');
    expect(screen.queryByText('Norouz Festival')).not.toBeInTheDocument();
  });

  it('puts the search in the address, so a result can be shared', async () => {
    mockFetch(signedOut, filterCategories, all(), all([calligraphy]));
    const router = renderApp('/events');
    await screen.findAllByRole('article');

    await searchFor('persian workshop');

    await screen.findByText('1 event found for “persian workshop”');
    expect(router.state.location.pathname).toBe('/events');
    expect(router.state.location.search).toBe('?search=persian+workshop');
  });

  it('runs the search that is already in the address, and fills the box with it', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all([calligraphy, film]));
    renderApp('/events?search=persian');

    expect(await screen.findByText('2 events found for “persian”')).toBeInTheDocument();
    expect(box()).toHaveValue('persian');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/events?search=persian');
  });

  it('sends characters like & safely encoded', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all(), all([]));
    renderApp('/events');
    await screen.findAllByRole('article');

    await searchFor('food & music #1');

    await screen.findByText(/No events match/);
    expect(fetchMock.mock.calls[3][0]).toBe('/api/events?search=food+%26+music+%231');
  });

  it('trims what was typed', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all(), all([film]));
    renderApp('/events');
    await screen.findAllByRole('article');

    await searchFor('   film   ');

    await screen.findByText('1 event found for “film”');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/events?search=film');
  });

  it('says so, with a way to clear the search, when nothing matches', async () => {
    mockFetch(signedOut, filterCategories, all(), all([]), all());
    renderApp('/events');
    await screen.findAllByRole('article');

    await searchFor('zzzzzz');

    expect(await screen.findByText('No events match “zzzzzz”. Try a different word, or clear the search.')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(await screen.findAllByRole('article')).toHaveLength(3);
    expect(box()).toHaveValue('');
  });

  it('clears a search that found results, back to all the events', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all(), all([film]), all());
    renderApp('/events');
    await screen.findAllByRole('article');
    await searchFor('film');
    await screen.findByText('1 event found for “film”');

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(await screen.findByText('3 events')).toBeInTheDocument();
    expect(box()).toHaveValue('');
    expect(fetchMock.mock.calls[4][0]).toBe('/api/events');
  });

  it('shows all the events again when the search is submitted empty', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all([film]), all());
    renderApp('/events?search=film');
    await screen.findByText('1 event found for “film”');

    await searchFor('');

    expect(await screen.findByText('3 events')).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe('/api/events');
  });

  it('follows the back button, in the address and in the box', async () => {
    mockFetch(signedOut, filterCategories, all(), all([film]), all());
    const router = renderApp('/events');
    await screen.findAllByRole('article');
    await searchFor('film');
    await screen.findByText('1 event found for “film”');

    await act(() => router.navigate(-1));

    expect(await screen.findByText('3 events')).toBeInTheDocument();
    expect(box()).toHaveValue('');
    expect(router.state.location.search).toBe('');
  });

  // REQ-4.4.4
  it('shows a loading indicator while a search runs', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => signedOut.body })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => filterCategories.body })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => all().body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/events');
    await screen.findAllByRole('article');

    await searchFor('film');

    expect(await screen.findByText('Loading events')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => all([film]).body });
    expect(await screen.findByText('1 event found for “film”')).toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a refused search in plain words', async () => {
    mockFetch(signedOut, filterCategories, all(), { status: 400, body: { error: 'Search for at most 100 characters.' } });
    renderApp('/events');
    await screen.findAllByRole('article');

    await searchFor('film');

    expect(await screen.findByRole('alert')).toHaveTextContent('Search for at most 100 characters.');
  });

  // ACC-003
  it('can be used with the keyboard alone, and keeps the focus in the search box', async () => {
    mockFetch(signedOut, filterCategories, all(), all([film]));
    renderApp('/events');
    await screen.findAllByRole('article');

    box().focus();
    await userEvent.keyboard('film{Enter}');

    await screen.findByText('1 event found for “film”');
    expect(box()).toHaveFocus();
  });

  it('announces how many events were found', async () => {
    mockFetch(signedOut, filterCategories, all([calligraphy, film]));
    renderApp('/events?search=persian');

    expect(await screen.findByText('2 events found for “persian”')).toHaveAttribute('role', 'status');
  });

  // REQ-4.1.3 what was searched for comes back from the address
  it('shows a search containing markup as plain text', async () => {
    mockFetch(signedOut, filterCategories, all([]));
    renderApp('/events?search=%3Cscript%3Ealert(1)%3C%2Fscript%3E');

    expect(await screen.findByText(/No events match “<script>alert\(1\)<\/script>”\./)).toBeInTheDocument();
    expect(document.body.querySelector('script')).toBeNull();
  });

  it('is open to a visitor who is not logged in', async () => {
    mockFetch(signedOut, filterCategories, all([film]));
    renderApp('/events?search=film');

    expect(await screen.findByText('1 event found for “film”')).toBeInTheDocument();
  });

  it('keeps the search when an event is opened and the way back is used', async () => {
    mockFetch(signedOut, filterCategories, all([film]), { status: 200, body: { event: { ...film, endsAt: null, organizerName: 'X', organizerContact: 'x@example.com' } } }, filterCategories, all([film]));
    const router = renderApp('/events?search=film');

    await userEvent.click(await screen.findByRole('link', { name: 'Persian Film Night' }));
    await screen.findByRole('heading', { level: 2, name: 'Organizer' });
    await act(() => router.navigate(-1));

    expect(await screen.findByText('1 event found for “film”')).toBeInTheDocument();
    expect(box()).toHaveValue('film');
  });
});
