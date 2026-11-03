import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { eventPage, mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const base = { startsAt: '2026-12-12T16:00:00.000Z', location: 'Hamilton', past: false };
const norouz = { ...base, id: '1', title: 'Norouz Festival', category: 'Festival', description: 'New Year.' };
const calligraphy = { ...base, id: '2', title: 'Persian Calligraphy Workshop', category: 'Workshop', description: 'Ink.' };
const film = { ...base, id: '3', title: 'Persian Film Night', category: 'Cultural Events', description: 'Film.' };
const music = { ...base, id: '4', title: 'Classical Music Evening', category: 'Cultural Events', description: 'Setar.' };
const categories = {
  status: 200,
  body: { categories: [{ id: '1', name: 'Festival' }, { id: '2', name: 'Workshop' }, { id: '3', name: 'Cultural Events' }] },
};
const list = (events = [norouz, calligraphy, film, music]) => ({ status: 200, body: eventPage(events) });

const filter = () => screen.getByRole('group', { name: 'Filter by category' });
const chip = (name: string) => within(filter()).getByRole('button', { name });
const pressed = () => within(filter()).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

// REQ-3.7.5 / FE-004
describe('Filtering the events by category', () => {
  it('offers All and every event category as buttons, with All pressed to start', async () => {
    const fetchMock = mockFetch(signedOut, categories, list());
    renderApp('/events');

    await screen.findAllByRole('article');
    expect(within(filter()).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Festival', 'Workshop', 'Cultural Events']);
    expect(pressed()).toEqual(['All']);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/categories?type=event');
  });

  // FE-004: select 'Cultural Events' and only cultural events are displayed
  it('shows only the events in the category that was chosen', async () => {
    const fetchMock = mockFetch(signedOut, categories, list(), list([film, music]));
    renderApp('/events');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Cultural Events'));

    expect(await screen.findByText('2 events in Cultural Events')).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe('/api/events?category=Cultural+Events');
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(cards.every((c) => c.textContent?.includes('Cultural Events'))).toBe(true);
    expect(screen.queryByText('Norouz Festival')).not.toBeInTheDocument();
  });

  it('marks the category in use as pressed, and nothing else', async () => {
    mockFetch(signedOut, categories, list(), list([calligraphy]));
    renderApp('/events');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Workshop'));
    await screen.findByText('1 event in Workshop');

    expect(pressed()).toEqual(['Workshop']);
    expect(chip('All')).toHaveAttribute('aria-pressed', 'false');
  });

  it('puts the category in the address, so a filtered list can be shared', async () => {
    mockFetch(signedOut, categories, list(), list([film, music]));
    const router = renderApp('/events');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Cultural Events'));

    await screen.findByText('2 events in Cultural Events');
    expect(router.state.location.search).toBe('?category=Cultural+Events');
  });

  it('shows everything again when All is pressed', async () => {
    const fetchMock = mockFetch(signedOut, categories, list([calligraphy]), list());
    const router = renderApp('/events?category=Workshop');
    await screen.findByText('1 event in Workshop');

    await userEvent.click(chip('All'));

    expect(await screen.findByText('4 events')).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe('/api/events');
    expect(router.state.location.search).toBe('');
    expect(pressed()).toEqual(['All']);
  });

  it('runs the filter that is already in the address, and presses its button', async () => {
    const fetchMock = mockFetch(signedOut, categories, list([film, music]));
    renderApp('/events?category=Cultural%20Events');

    expect(await screen.findByText('2 events in Cultural Events')).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/events?category=Cultural+Events');
    expect(pressed()).toEqual(['Cultural Events']);
  });

  it('presses the right button whatever case the address uses', async () => {
    mockFetch(signedOut, categories, list([film, music]));
    renderApp('/events?category=cultural%20events');

    await screen.findAllByRole('article');
    expect(pressed()).toEqual(['Cultural Events']);
  });

  it('says "1 event" for a single event in the category', async () => {
    mockFetch(signedOut, categories, list([calligraphy]));
    renderApp('/events?category=Workshop');

    expect(await screen.findByText('1 event in Workshop')).toHaveAttribute('role', 'status');
  });

  describe('together with the search', () => {
    it('applies both, in the request and in the address', async () => {
      const fetchMock = mockFetch(signedOut, categories, list([calligraphy, film]), list([film]));
      const router = renderApp('/events?search=persian');
      await screen.findByText('2 events found for “persian”');

      await userEvent.click(chip('Cultural Events'));

      expect(await screen.findByText('1 event found for “persian” in Cultural Events')).toBeInTheDocument();
      expect(fetchMock.mock.calls[3][0]).toBe('/api/events?search=persian&category=Cultural+Events');
      expect(router.state.location.search).toBe('?search=persian&category=Cultural+Events');
    });

    it('keeps the category when a search is made', async () => {
      const fetchMock = mockFetch(signedOut, categories, list([film, music]), list([film]));
      const router = renderApp('/events?category=Cultural%20Events');
      await screen.findByText('2 events in Cultural Events');

      await userEvent.type(screen.getByRole('searchbox', { name: 'Search events' }), 'persian');
      await userEvent.click(screen.getByRole('button', { name: 'Search' }));

      await screen.findByText('1 event found for “persian” in Cultural Events');
      expect(fetchMock.mock.calls[3][0]).toBe('/api/events?search=persian&category=Cultural+Events');
      expect(router.state.location.search).toBe('?category=Cultural+Events&search=persian');
    });

    it('keeps the search when the category is changed back to All', async () => {
      const fetchMock = mockFetch(signedOut, categories, list([film]), list([calligraphy, film]));
      renderApp('/events?search=persian&category=Cultural%20Events');
      await screen.findByText('1 event found for “persian” in Cultural Events');

      await userEvent.click(chip('All'));

      expect(await screen.findByText('2 events found for “persian”')).toBeInTheDocument();
      expect(fetchMock.mock.calls[3][0]).toBe('/api/events?search=persian');
    });

    it('keeps the category when the search is cleared', async () => {
      const fetchMock = mockFetch(signedOut, categories, list([film]), list([film, music]));
      renderApp('/events?search=persian&category=Cultural%20Events');
      await screen.findByText('1 event found for “persian” in Cultural Events');

      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

      expect(await screen.findByText('2 events in Cultural Events')).toBeInTheDocument();
      expect(fetchMock.mock.calls[3][0]).toBe('/api/events?category=Cultural+Events');
      expect(screen.getByRole('searchbox', { name: 'Search events' })).toHaveValue('');
    });
  });

  describe('when nothing is found', () => {
    it('says the category has no events, and offers to show them all', async () => {
      mockFetch(signedOut, categories, list([]), list());
      renderApp('/events?category=Workshop');

      expect(await screen.findByText('No events in Workshop yet.')).toHaveAttribute('role', 'status');
      expect(screen.queryByRole('article')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Show all categories' }));

      expect(await screen.findAllByRole('article')).toHaveLength(4);
      expect(pressed()).toEqual(['All']);
    });

    it('says so, for a search within a category, and offers to clear either one', async () => {
      mockFetch(signedOut, categories, list([]), list([film]));
      renderApp('/events?search=zzz&category=Workshop');

      expect(await screen.findByText('No events match “zzz” in Workshop. Try a different word or category.')).toHaveAttribute('role', 'status');
      expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show all categories' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(await screen.findByText('1 event in Workshop')).toBeInTheDocument();
    });

    it('lets the member show all categories while keeping the search', async () => {
      const fetchMock = mockFetch(signedOut, categories, list([]), list([film]));
      renderApp('/events?search=film&category=Workshop');
      await screen.findByText(/No events match “film” in Workshop/);

      await userEvent.click(screen.getByRole('button', { name: 'Show all categories' }));

      expect(await screen.findByText('1 event found for “film”')).toBeInTheDocument();
      expect(fetchMock.mock.calls[3][0]).toBe('/api/events?search=film');
    });

    it('treats a category that does not exist as one with no events, with no button pressed', async () => {
      mockFetch(signedOut, categories, list([]));
      renderApp('/events?category=Grocery');

      expect(await screen.findByText('No events in Grocery yet.')).toBeInTheDocument();
      expect(pressed()).toEqual([]);
    });
  });

  // REQ-4.4.4
  it('shows a loading indicator while a category loads, and keeps the buttons on screen', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => signedOut.body })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => categories.body })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => list().body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/events');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Workshop'));

    expect(await screen.findByText('Loading events')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(filter()).toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => list([calligraphy]).body });
    expect(await screen.findByText('1 event in Workshop')).toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a failed filter in plain words, and keeps the buttons', async () => {
    mockFetch(signedOut, categories, list(), { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/events');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Workshop'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(filter()).toBeInTheDocument();
  });

  it('leaves the filter out, and still lists the events, when the categories cannot be loaded', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch(signedOut, { status: 500, body: { error: 'Something went wrong. Please try again.' } }, list());
    renderApp('/events');

    expect(await screen.findAllByRole('article')).toHaveLength(4);
    expect(screen.queryByRole('group', { name: 'Filter by category' })).not.toBeInTheDocument();
    error.mockRestore();
  });

  // ACC-003
  it('works with the keyboard alone, and keeps the focus on the button that was pressed', async () => {
    mockFetch(signedOut, categories, list(), list([calligraphy]));
    renderApp('/events');
    await screen.findAllByRole('article');

    chip('Workshop').focus();
    await userEvent.keyboard('{Enter}');

    await screen.findByText('1 event in Workshop');
    expect(chip('Workshop')).toHaveFocus();
    expect(chip('Workshop')).toHaveAttribute('aria-pressed', 'true');
  });

  it('also works with the space bar', async () => {
    mockFetch(signedOut, categories, list(), list([calligraphy]));
    renderApp('/events');
    await screen.findAllByRole('article');

    chip('Workshop').focus();
    await userEvent.keyboard(' ');

    expect(await screen.findByText('1 event in Workshop')).toBeInTheDocument();
  });

  it('follows the back button', async () => {
    mockFetch(signedOut, categories, list(), list([calligraphy]), list());
    const router = renderApp('/events');
    await screen.findAllByRole('article');
    await userEvent.click(chip('Workshop'));
    await screen.findByText('1 event in Workshop');

    await act(() => router.navigate(-1));

    expect(await screen.findByText('4 events')).toBeInTheDocument();
    expect(pressed()).toEqual(['All']);
  });

  // REQ-4.1.3 the category comes back from the address
  it('shows a category containing markup as plain text', async () => {
    mockFetch(signedOut, categories, list([]));
    renderApp('/events?category=%3Cscript%3Ealert(1)%3C%2Fscript%3E');

    expect(await screen.findByText(/No events in <script>alert\(1\)<\/script> yet\./)).toBeInTheDocument();
    expect(document.body.querySelector('script')).toBeNull();
  });

  it('is open to a visitor who is not logged in', async () => {
    mockFetch(signedOut, categories, list([calligraphy]));
    renderApp('/events?category=Workshop');

    expect(await screen.findByText('1 event in Workshop')).toBeInTheDocument();
  });
});
