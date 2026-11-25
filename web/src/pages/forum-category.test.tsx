import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { forumPostPage, mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const tea = {
  id: '1',
  title: 'Best tea shops',
  excerpt: 'Loose leaf and saffron rock sugar.',
  createdAt: '2026-12-12T16:00:00.000Z', // 11:00 AM in Ontario
  views: 7,
  authorId: '4',
  authorName: 'Ava Rahimi',
};
const orphan = { ...tea, id: '2', title: 'Old question', authorId: null, authorName: null, views: 1 };
const found = (posts: object[], paging = {}) => ({ status: 200, body: forumPostPage(posts, paging) });

// REQ-3.5.2
describe('Forum category page', () => {
  it('lists every post with its title, author, date and time, views and excerpt', async () => {
    const fetchMock = mockFetch(signedOut, found([tea, orphan]));
    renderApp('/forum/categories/1');

    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 1, name: 'General Discussion' })).toBeInTheDocument();
    expect(within(cards[0]).getByRole('heading', { level: 2, name: 'Best tea shops' })).toBeInTheDocument();
    expect(within(cards[0]).getByText(/Ava Rahimi/)).toBeInTheDocument();
    expect(within(cards[0]).getByText('Sat, December 12, 2026, 11:00 AM')).toBeInTheDocument();
    expect(within(cards[0]).getByText(/7 views/)).toBeInTheDocument();
    expect(within(cards[0]).getByText('Loose leaf and saffron rock sugar.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/forum/categories/1/posts');
  });

  it('keeps the order the server sent', async () => {
    mockFetch(signedOut, found([tea, orphan]));
    renderApp('/forum/categories/1');

    const cards = await screen.findAllByRole('article');
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['Best tea shops', 'Old question']);
  });

  it('calls an author without an account a former member, and says "1 view"', async () => {
    mockFetch(signedOut, found([orphan]));
    renderApp('/forum/categories/1');

    const card = await screen.findByRole('article');
    expect(within(card).getByText(/Former member/)).toBeInTheDocument();
    expect(within(card).getByText(/1 view$/)).toBeInTheDocument();
  });

  it('announces how many posts there are', async () => {
    mockFetch(signedOut, found([tea, orphan]));
    renderApp('/forum/categories/1');

    expect(await screen.findByText('2 posts')).toHaveAttribute('role', 'status');
  });

  it('says so when the category has no posts', async () => {
    mockFetch(signedOut, found([]));
    renderApp('/forum/categories/1');

    expect(await screen.findByText('There are no posts in this category yet.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  // REQ-4.1.3
  it('shows a title and excerpt containing markup as plain text', async () => {
    mockFetch(signedOut, found([{ ...tea, title: '<script>alert(1)</script>', excerpt: '<img src=x onerror=alert(1)>' }]));
    renderApp('/forum/categories/1');

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '<script>alert(1)</script>' })).toBeInTheDocument();
    expect(document.body.querySelector('script')).toBeNull();
    expect(document.body.querySelector('img[onerror]')).toBeNull();
  });

  // REQ-4.4.4
  it('shows a loading indicator until the posts arrive', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => signedOut.body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/forum/categories/1');

    expect(await screen.findByText('Loading posts')).toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => forumPostPage([tea]) });
    expect(await screen.findByRole('article')).toBeInTheDocument();
    expect(screen.queryByText('Loading posts')).not.toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a failure in plain words', async () => {
    mockFetch(signedOut, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/forum/categories/1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('says so when the category does not exist, and links back to the forum', async () => {
    mockFetch(signedOut, { status: 404, body: { error: 'Forum category not found.' } });
    renderApp('/forum/categories/999');

    expect(await screen.findByRole('heading', { level: 1, name: 'Category not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All forum categories' })).toHaveAttribute('href', '/forum');
  });

  it('is open to a visitor who is not logged in', async () => {
    mockFetch(signedOut, found([tea]));
    const router = renderApp('/forum/categories/1');

    await screen.findByRole('article');
    expect(router.state.location.pathname).toBe('/forum/categories/1');
  });

  // REQ-4.4.2 two clicks from the home page
  it('is reached from the forum page', async () => {
    mockFetch(
      signedOut,
      { status: 200, body: { categories: [{ id: '1', name: 'General Discussion' }, { id: '5', name: 'Q&A' }] } },
      found([tea]),
    );
    renderApp('/forum');

    await userEvent.click(await screen.findByRole('link', { name: 'General Discussion' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'General Discussion' })).toBeInTheDocument();
  });
});

// REQ-3.7.9
describe('Forum post pagination', () => {
  const many = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({ ...tea, id: String(from + i), title: `Post ${from + i}` }));

  it('shows the page navigation and which posts are on screen', async () => {
    mockFetch(signedOut, found(many(1, 15), { total: 32 }));
    renderApp('/forum/categories/1');

    expect(await screen.findByText('Showing 1–15 of 32 posts. Page 1 of 3.')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Forum post pages' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Previous', '1', '2', '3', 'Next']);
    expect(within(nav).getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  });

  it('asks for the page in the address and shows it', async () => {
    const fetchMock = mockFetch(signedOut, found(many(16, 30), { page: 2, total: 32 }));
    renderApp('/forum/categories/1?page=2');

    expect(await screen.findByText('Showing 16–30 of 32 posts. Page 2 of 3.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/forum/categories/1/posts?page=2');
  });

  it('goes to the next page when Next is used, and puts the page in the address', async () => {
    const fetchMock = mockFetch(signedOut, found(many(1, 15), { total: 32 }), found(many(16, 30), { page: 2, total: 32 }));
    const router = renderApp('/forum/categories/1');

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Showing 16–30 of 32 posts. Page 2 of 3.')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/forum/categories/1/posts?page=2');
    expect(screen.getByRole('status')).toHaveFocus();
  });

  it('has no navigation when everything fits on one page', async () => {
    mockFetch(signedOut, found(many(1, 3)));
    renderApp('/forum/categories/1');

    await screen.findByText('3 posts');
    expect(screen.queryByRole('navigation', { name: 'Forum post pages' })).not.toBeInTheDocument();
  });

  it('explains a page number past the last page and offers the first', async () => {
    mockFetch(signedOut, found([], { page: 9, total: 20 }));
    renderApp('/forum/categories/1?page=9');

    expect(await screen.findByText('There is no page 9. This category has 2 pages.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to the first page' })).toBeInTheDocument();
  });
});
