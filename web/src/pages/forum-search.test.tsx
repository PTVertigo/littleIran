import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const base = { excerpt: 'Some words.', createdAt: '2026-10-20T15:00:00.000Z', views: 3, authorId: '1', authorName: 'Ava Rahimi' };
const tea = { ...base, id: '1', title: 'Best saffron tea', categoryId: '14', category: 'General Discussion' };
const nowruz = { ...base, id: '2', title: 'Nowruz plans', categoryId: '16', category: 'Event Planning', views: 1, authorId: null, authorName: null };
const filterCategories = {
  status: 200,
  body: { categories: [{ id: '14', name: 'General Discussion' }, { id: '16', name: 'Event Planning' }] },
};
const results = (posts = [tea, nowruz], extra = {}) => ({
  status: 200,
  body: { posts, page: 1, pageSize: 15, total: posts.length, totalPages: 1, ...extra },
});

const box = () => screen.getByRole('searchbox', { name: 'Search posts' });
const searchFor = async (text: string) => {
  await userEvent.clear(box());
  if (text) await userEvent.type(box(), text);
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
};

// REQ-3.7.3 search forum posts, REQ-3.7.6 filter them by category
describe('Forum search page', () => {
  it('lists the posts with the category of each, in a search landmark with a hint', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, results());
    renderApp('/forum/search');

    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(fetchMock.mock.calls[2][0]).toBe('/api/forum/posts');
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(box()).toHaveAccessibleDescription('Words in the title or the post, for example “saffron tea”.');
    expect(screen.getByRole('status')).toHaveTextContent('2 posts');
    const [first, second] = screen.getAllByRole('article');
    expect(first).toHaveTextContent('General Discussion');
    expect(first).toHaveTextContent('Ava Rahimi');
    expect(screen.getByRole('link', { name: 'General Discussion', description: '' })).toHaveAttribute('href', '/forum/categories/14');
    expect(second).toHaveTextContent('Former member');
  });

  it('searches, puts the words in the address and says what was found', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, results(), results([tea]));
    const router = renderApp('/forum/search');
    await screen.findAllByRole('article');

    await searchFor('saffron');

    await screen.findByText('1 post found for “saffron”');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/forum/posts?search=saffron');
    expect(router.state.location.search).toBe('?search=saffron');
    expect(screen.queryByText('Nowruz plans')).not.toBeInTheDocument();
  });

  it('opens from a shared link with the words in the box', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, results([tea]));
    renderApp('/forum/search?search=saffron&category=General%20Discussion');

    await screen.findByText('1 post found for “saffron” in General Discussion');
    expect(box()).toHaveValue('saffron');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/forum/posts?search=saffron&category=General+Discussion');
    expect(await screen.findByRole('button', { name: 'General Discussion', pressed: true })).toBeInTheDocument();
  });

  it('filters by category with the buttons, and back to All', async () => {
    const fetchMock = mockFetch(signedOut, filterCategories, results(), results([nowruz]), results());
    const router = renderApp('/forum/search');
    await screen.findAllByRole('article');

    await userEvent.click(await screen.findByRole('button', { name: 'Event Planning' }));

    await screen.findByText('1 post in Event Planning');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/forum/posts?category=Event+Planning');
    expect(screen.getByRole('button', { name: 'Event Planning' })).toHaveAttribute('aria-pressed', 'true');
    expect(router.state.location.search).toBe('?category=Event+Planning');

    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await screen.findByText('2 posts');
    expect(router.state.location.search).toBe('');
  });

  it('says so, and offers a way out, when nothing matches', async () => {
    mockFetch(signedOut, filterCategories, results(), results([]), results());
    renderApp('/forum/search');
    await screen.findAllByRole('article');

    await searchFor('zzzz');

    expect(await screen.findByText('No posts match “zzzz”. Try a different word, or clear the search.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(box()).toHaveValue('');
  });

  it('says so when a category has no posts', async () => {
    mockFetch(signedOut, filterCategories, results([]));
    renderApp('/forum/search?category=Q%26A');

    expect(await screen.findByText('No posts in Q&A yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all categories' })).toBeInTheDocument();
  });

  it('shows the page and moves between pages', async () => {
    const fetchMock = mockFetch(
      signedOut,
      filterCategories,
      results([tea], { total: 20, totalPages: 2 }),
      results([nowruz], { page: 2, total: 20, totalPages: 2 }),
    );
    renderApp('/forum/search');

    await screen.findByText('Showing 1–1 of 20 posts. Page 1 of 2.');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    await screen.findByText('Showing 16–16 of 20 posts. Page 2 of 2.');
    expect(fetchMock.mock.calls[3][0]).toBe('/api/forum/posts?page=2');
  });

  // REQ-4.2.1
  it('explains a failure in plain words', async () => {
    mockFetch(signedOut, filterCategories, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/forum/search');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('is reached from the forum page', async () => {
    mockFetch(signedOut, { status: 200, body: filterCategories.body }, filterCategories, results());
    renderApp('/forum');

    await userEvent.click(await screen.findByRole('link', { name: 'Search posts' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Search the forum' })).toBeInTheDocument();
  });
});
