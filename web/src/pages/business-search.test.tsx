import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const norouz = { id: '1', name: 'Norouz Restaurant', category: 'Restaurant', city: 'Hamilton', description: 'Kebabs.' };
const cafe = { id: '2', name: 'Persian Cafe', category: 'Restaurant', city: 'Toronto', description: 'Tea.' };
const rugs = { id: '3', name: 'Persian Rug Gallery', category: 'Retail', city: 'Oakville', description: 'Rugs.' };
const all = (businesses = [norouz, cafe, rugs]) => ({ status: 200, body: { businesses } });

const box = () => screen.getByRole('searchbox', { name: 'Search businesses' });
const searchFor = async (text: string) => {
  await userEvent.clear(box());
  if (text) await userEvent.type(box(), text);
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
};

const filterCategories = {
  status: 200,
  body: {
    categories: [
      { id: '1', name: 'Restaurant' },
      { id: '2', name: 'Retail' },
    ],
  },
};

// REQ-3.7.1 / FE-003
describe('Searching the business directory', () => {
  it('has a search box in a search landmark, with a hint', async () => {
    mockFetch(signedOut, filterCategories, all());
    renderApp('/businesses');

    await screen.findAllByRole('article');
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(box()).toHaveAccessibleDescription('By name or category, for example “Persian restaurant”.');
    expect(box()).toHaveAttribute('maxlength', '100');
    expect(box()).toHaveValue('');
  });

  it('shows the matching businesses with their basic information', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all(), all([norouz, cafe]));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await searchFor('Restaurant');

    await screen.findByText('2 businesses found for “Restaurant”');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?search=Restaurant');
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Norouz Restaurant');
    expect(cards[0]).toHaveTextContent('Restaurant · Hamilton');
    expect(screen.queryByText('Persian Rug Gallery')).not.toBeInTheDocument();
  });

  it('puts the search in the address, so a result can be shared', async () => {
    mockFetch(signedOut, filterCategories, all(), all([cafe]));
    const router = renderApp('/businesses');
    await screen.findAllByRole('article');

    await searchFor('persian restaurant');

    await screen.findByText('1 business found for “persian restaurant”');
    expect(router.state.location.pathname).toBe('/businesses');
    expect(router.state.location.search).toBe('?search=persian+restaurant');
  });

  it('runs the search that is already in the address, and fills the box with it', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all([cafe, rugs]));
    renderApp('/businesses?search=persian');

    expect(await screen.findByText('2 businesses found for “persian”')).toBeInTheDocument();
    expect(box()).toHaveValue('persian');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/businesses?search=persian');
  });

  it('sends characters like & safely encoded', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all(), all([]));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await searchFor('health & wellness #1');

    await screen.findByText(/No businesses match/);
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?search=health+%26+wellness+%231');
  });

  it('trims what was typed', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all(), all([cafe]));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await searchFor('   cafe   ');

    await screen.findByText('1 business found for “cafe”');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?search=cafe');
  });

  it('says so, with a way to clear the search, when nothing matches', async () => {
    mockFetch(signedOut, filterCategories, all(), all([]), all());
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await searchFor('zzzzzz');

    expect(await screen.findByText('No businesses match “zzzzzz”. Try a different word, or clear the search.')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(await screen.findAllByRole('article')).toHaveLength(3);
    expect(box()).toHaveValue('');
  });

  it('clears a search that found results, back to the whole directory', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all(), all([cafe]), all());
    renderApp('/businesses');
    await screen.findAllByRole('article');
    await searchFor('cafe');
    await screen.findByText('1 business found for “cafe”');

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(await screen.findByText('3 businesses')).toBeInTheDocument();
    expect(box()).toHaveValue('');
    expect(fetchMock.mock.calls[4][0]).toBe('/api/businesses');
  });

  it('shows the whole directory again when the search is submitted empty', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, all([cafe]), all());
    renderApp('/businesses?search=cafe');
    await screen.findByText('1 business found for “cafe”');

    await searchFor('');

    expect(await screen.findByText('3 businesses')).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses');
  });

  it('follows the back button, in the address and in the box', async () => {
    mockFetch(signedOut, filterCategories, all(), all([cafe]), all());
    const router = renderApp('/businesses');
    await screen.findAllByRole('article');
    await searchFor('cafe');
    await screen.findByText('1 business found for “cafe”');

    await act(() => router.navigate(-1));

    expect(await screen.findByText('3 businesses')).toBeInTheDocument();
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
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await searchFor('cafe');

    expect(await screen.findByText('Loading businesses')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => all([cafe]).body });
    expect(await screen.findByText('1 business found for “cafe”')).toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a refused search in plain words', async () => {
    mockFetch(signedOut, filterCategories, all(), { status: 400, body: { error: 'Search for at most 100 characters.' } });
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await searchFor('cafe');

    expect(await screen.findByRole('alert')).toHaveTextContent('Search for at most 100 characters.');
  });

  // ACC-003
  it('can be used with the keyboard alone, and keeps the focus in the search box', async () => {
    mockFetch(signedOut, filterCategories, all(), all([cafe]));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    box().focus();
    await userEvent.keyboard('cafe{Enter}');

    await screen.findByText('1 business found for “cafe”');
    expect(box()).toHaveFocus();
  });

  it('announces how many businesses were found', async () => {
    mockFetch(signedOut, filterCategories, all([norouz, cafe]));
    renderApp('/businesses?search=restaurant');

    // A status message, so a screen reader announces it
    expect(await screen.findByText('2 businesses found for “restaurant”')).toHaveAttribute('role', 'status');
  });

  // REQ-4.1.3 what was searched for comes back from the address
  it('shows a search containing markup as plain text', async () => {
    mockFetch(signedOut, filterCategories, all([]));
    renderApp('/businesses?search=%3Cscript%3Ealert(1)%3C%2Fscript%3E');

    expect(await screen.findByText(/No businesses match “<script>alert\(1\)<\/script>”\./)).toBeInTheDocument();
    expect(document.body.querySelector('script')).toBeNull();
  });

  it('is open to a visitor who is not logged in', async () => {
    mockFetch(signedOut, filterCategories, all([cafe]));
    renderApp('/businesses?search=cafe');

    expect(await screen.findByText('1 business found for “cafe”')).toBeInTheDocument();
  });
});
