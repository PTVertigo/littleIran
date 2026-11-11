import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const names = ['General Discussion', 'Business Recommendations', 'Event Planning', 'Cultural Exchange', 'Q&A'];
const forumCategories = { status: 200, body: { categories: names.map((name, i) => ({ id: String(i + 1), name })) } };

// REQ-3.5.1
describe('Forum page', () => {
  it('lists every forum category, in order', async () => {
    const fetchMock = mockFetch(signedOut, forumCategories);
    renderApp('/forum');

    const cards = await screen.findAllByRole('article');
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual(names);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/categories?type=forum');
  });

  it('has one main heading and a heading for the list', async () => {
    mockFetch(signedOut, forumCategories);
    renderApp('/forum');

    await screen.findAllByRole('article');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Categories' })).toBeInTheDocument();
  });

  // REQ-4.4.4
  it('shows a loading indicator until the categories arrive', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => signedOut.body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/forum');

    expect(await screen.findByText('Loading forum categories')).toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => forumCategories.body });
    expect(await screen.findAllByRole('article')).toHaveLength(5);
    expect(screen.queryByText('Loading forum categories')).not.toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a failure in plain words', async () => {
    mockFetch(signedOut, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/forum');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('says so when there are no categories', async () => {
    mockFetch(signedOut, { status: 200, body: { categories: [] } });
    renderApp('/forum');

    expect(await screen.findByText('The forum has no categories yet.')).toBeInTheDocument();
  });

  it('is open to a visitor who is not logged in', async () => {
    mockFetch(signedOut, forumCategories);
    const router = renderApp('/forum');

    await screen.findAllByRole('article');
    expect(router.state.location.pathname).toBe('/forum');
  });

  // REQ-4.4.2 reachable in one click
  it('is reached from the navigation and from the home page button', async () => {
    mockFetch(signedOut, forumCategories);
    renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: 'Join the forum' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Discussion forum' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Forum' })).toHaveAttribute('aria-current', 'page');
  });
});
