import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { businessPage, mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const norouz = { id: '1', name: 'Norouz Restaurant', category: 'Restaurant', city: 'Hamilton', description: 'Kebabs.' };
const cafe = { id: '2', name: 'Persian Cafe', category: 'Restaurant', city: 'Toronto', description: 'Tea.' };
const rugs = { id: '3', name: 'Persian Rug Gallery', category: 'Retail', city: 'Oakville', description: 'Rugs.' };
const clinic = { id: '4', name: 'Hafez Clinic', category: 'Health & Wellness', city: 'Burlington', description: 'Care.' };
const categories = {
  status: 200,
  body: {
    categories: [
      { id: '1', name: 'Restaurant' },
      { id: '2', name: 'Retail' },
      { id: '6', name: 'Health & Wellness' },
    ],
  },
};
const list = (businesses = [norouz, cafe, rugs, clinic]) => ({ status: 200, body: businessPage(businesses) });

const filter = () => screen.getByRole('group', { name: 'Filter by category' });
const chip = (name: string) => within(filter()).getByRole('button', { name });
const pressed = () => within(filter()).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);

// REQ-3.7.4
describe('Filtering the business directory by category', () => {
  it('offers All and every category as buttons, with All pressed to start', async () => {
    mockFetch(signedOut, categories, list());
    renderApp('/businesses');

    await screen.findAllByRole('article');
    expect(within(filter()).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'All',
      'Restaurant',
      'Retail',
      'Health & Wellness',
    ]);
    expect(pressed()).toEqual(['All']);
  });

  it('gets the categories from the server', async () => {
    const fetchMock = mockFetch(signedOut, categories, list());
    renderApp('/businesses');

    await screen.findAllByRole('article');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/categories?type=business');
  });

  it('shows only the businesses in the category that was chosen', async () => {
    const fetchMock = mockFetch(signedOut, categories, list(), list([rugs]));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Retail'));

    expect(await screen.findByText('1 business in Retail')).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?category=Retail');
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Persian Rug Gallery');
    expect(cards[0]).toHaveTextContent('Retail · Oakville');
  });

  it('marks the category in use as pressed, and nothing else', async () => {
    mockFetch(signedOut, categories, list(), list([rugs]));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Retail'));
    await screen.findByText('1 business in Retail');

    expect(pressed()).toEqual(['Retail']);
    expect(chip('All')).toHaveAttribute('aria-pressed', 'false');
  });

  it('puts the category in the address, so a filtered list can be shared', async () => {
    mockFetch(signedOut, categories, list(), list([norouz, cafe]));
    const router = renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Restaurant'));

    await screen.findByText('2 businesses in Restaurant');
    expect(router.state.location.search).toBe('?category=Restaurant');
  });

  it('shows everything again when All is pressed', async () => {
    const fetchMock = mockFetch(signedOut, categories, list([rugs]), list());
    const router = renderApp('/businesses?category=Retail');
    await screen.findByText('1 business in Retail');

    await userEvent.click(chip('All'));

    expect(await screen.findByText('4 businesses')).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses');
    expect(router.state.location.search).toBe('');
    expect(pressed()).toEqual(['All']);
  });

  it('runs the filter that is already in the address, and presses its button', async () => {
    const fetchMock = mockFetch(signedOut, categories, list([rugs]));
    renderApp('/businesses?category=Retail');

    expect(await screen.findByText('1 business in Retail')).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/businesses?category=Retail');
    expect(pressed()).toEqual(['Retail']);
  });

  it('presses the right button whatever case the address uses', async () => {
    mockFetch(signedOut, categories, list([rugs]));
    renderApp('/businesses?category=retail');

    await screen.findByRole('article');
    expect(pressed()).toEqual(['Retail']);
  });

  it('sends a category with a space and an ampersand safely encoded', async () => {
    const fetchMock = mockFetch(signedOut, categories, list(), list([clinic]));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Health & Wellness'));

    expect(await screen.findByText('1 business in Health & Wellness')).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?category=Health+%26+Wellness');
  });

  describe('together with the search', () => {
    it('applies both, in the request and in the address', async () => {
      const fetchMock = mockFetch(signedOut, categories, list([cafe, rugs]), list([rugs]));
      const router = renderApp('/businesses?search=persian');
      await screen.findByText('2 businesses found for “persian”');

      await userEvent.click(chip('Retail'));

      expect(await screen.findByText('1 business found for “persian” in Retail')).toBeInTheDocument();
      expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?search=persian&category=Retail');
      expect(router.state.location.search).toBe('?search=persian&category=Retail');
    });

    it('keeps the category when a search is made', async () => {
      const fetchMock = mockFetch(signedOut, categories, list([rugs]), list([rugs]));
      const router = renderApp('/businesses?category=Retail');
      await screen.findByText('1 business in Retail');

      await userEvent.type(screen.getByRole('searchbox', { name: 'Search businesses' }), 'persian');
      await userEvent.click(screen.getByRole('button', { name: 'Search' }));

      await screen.findByText('1 business found for “persian” in Retail');
      expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?search=persian&category=Retail');
      expect(router.state.location.search).toBe('?category=Retail&search=persian');
    });

    it('keeps the search when the category is changed back to All', async () => {
      const fetchMock = mockFetch(signedOut, categories, list([rugs]), list([cafe, rugs]));
      renderApp('/businesses?search=persian&category=Retail');
      await screen.findByText('1 business found for “persian” in Retail');

      await userEvent.click(chip('All'));

      expect(await screen.findByText('2 businesses found for “persian”')).toBeInTheDocument();
      expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?search=persian');
    });

    it('keeps the category when the search is cleared', async () => {
      const fetchMock = mockFetch(signedOut, categories, list([rugs]), list([rugs, clinic]));
      renderApp('/businesses?search=persian&category=Retail');
      await screen.findByText('1 business found for “persian” in Retail');

      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

      expect(await screen.findByText('2 businesses in Retail')).toBeInTheDocument();
      expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?category=Retail');
      expect(screen.getByRole('searchbox', { name: 'Search businesses' })).toHaveValue('');
    });
  });

  describe('when nothing is found', () => {
    it('says the category has no businesses, and offers to show them all', async () => {
      mockFetch(signedOut, categories, list([]), list());
      renderApp('/businesses?category=Retail');

      expect(await screen.findByText('No businesses in Retail yet.')).toHaveAttribute('role', 'status');
      expect(screen.queryByRole('article')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Show all categories' }));

      expect(await screen.findAllByRole('article')).toHaveLength(4);
      expect(pressed()).toEqual(['All']);
    });

    it('says so, for a search within a category, and offers to clear either one', async () => {
      mockFetch(signedOut, categories, list([]), list([rugs]), list([]), list());
      renderApp('/businesses?search=cafe&category=Retail');

      expect(await screen.findByText('No businesses match “cafe” in Retail. Try a different word or category.')).toHaveAttribute('role', 'status');

      await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(await screen.findByText('1 business in Retail')).toBeInTheDocument();
    });

    it('lets the member show all categories while keeping the search', async () => {
      const fetchMock = mockFetch(signedOut, categories, list([]), list([cafe]));
      renderApp('/businesses?search=cafe&category=Retail');
      await screen.findByText(/No businesses match “cafe” in Retail/);

      await userEvent.click(screen.getByRole('button', { name: 'Show all categories' }));

      expect(await screen.findByText('1 business found for “cafe”')).toBeInTheDocument();
      expect(fetchMock.mock.calls[3][0]).toBe('/api/businesses?search=cafe');
    });

    it('treats a category that no longer exists as one with no businesses, with no button pressed', async () => {
      mockFetch(signedOut, categories, list([]));
      renderApp('/businesses?category=Grocery');

      expect(await screen.findByText('No businesses in Grocery yet.')).toBeInTheDocument();
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
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Retail'));

    expect(await screen.findByText('Loading businesses')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(filter()).toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => list([rugs]).body });
    expect(await screen.findByText('1 business in Retail')).toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a failed filter in plain words, and keeps the buttons', async () => {
    mockFetch(signedOut, categories, list(), { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/businesses');
    await screen.findAllByRole('article');

    await userEvent.click(chip('Retail'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(filter()).toBeInTheDocument();
  });

  it('leaves the filter out, and still lists the businesses, when the categories cannot be loaded', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch(signedOut, { status: 500, body: { error: 'Something went wrong. Please try again.' } }, list());
    renderApp('/businesses');

    expect(await screen.findAllByRole('article')).toHaveLength(4);
    expect(screen.queryByRole('group', { name: 'Filter by category' })).not.toBeInTheDocument();
    error.mockRestore();
  });

  // ACC-003
  it('works with the keyboard alone, and keeps the focus on the button that was pressed', async () => {
    mockFetch(signedOut, categories, list(), list([rugs]));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    chip('Retail').focus();
    await userEvent.keyboard('{Enter}');

    await screen.findByText('1 business in Retail');
    expect(chip('Retail')).toHaveFocus();
    expect(chip('Retail')).toHaveAttribute('aria-pressed', 'true');
  });

  it('also works with the space bar', async () => {
    mockFetch(signedOut, categories, list(), list([rugs]));
    renderApp('/businesses');
    await screen.findAllByRole('article');

    chip('Retail').focus();
    await userEvent.keyboard(' ');

    expect(await screen.findByText('1 business in Retail')).toBeInTheDocument();
  });

  it('follows the back button', async () => {
    mockFetch(signedOut, categories, list(), list([rugs]), list());
    const router = renderApp('/businesses');
    await screen.findAllByRole('article');
    await userEvent.click(chip('Retail'));
    await screen.findByText('1 business in Retail');

    await act(() => router.navigate(-1));

    expect(await screen.findByText('4 businesses')).toBeInTheDocument();
    expect(pressed()).toEqual(['All']);
  });

  it('announces how many businesses are in the category', async () => {
    mockFetch(signedOut, categories, list([norouz, cafe]));
    renderApp('/businesses?category=Restaurant');

    expect(await screen.findByText('2 businesses in Restaurant')).toHaveAttribute('role', 'status');
  });

  // REQ-4.1.3 the category comes back from the address
  it('shows a category containing markup as plain text', async () => {
    mockFetch(signedOut, categories, list([]));
    renderApp('/businesses?category=%3Cscript%3Ealert(1)%3C%2Fscript%3E');

    expect(await screen.findByText(/No businesses in <script>alert\(1\)<\/script> yet\./)).toBeInTheDocument();
    expect(document.body.querySelector('script')).toBeNull();
  });

  it('is open to a visitor who is not logged in', async () => {
    mockFetch(signedOut, categories, list([rugs]));
    renderApp('/businesses?category=Retail');

    expect(await screen.findByText('1 business in Retail')).toBeInTheDocument();
  });
});
