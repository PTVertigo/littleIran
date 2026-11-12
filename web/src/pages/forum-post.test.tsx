import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { forumPostPage, mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const post = {
  id: '8',
  title: 'Best tea shops in the GTA',
  content: 'Loose leaf and saffron.\nShare your finds.',
  views: 4,
  createdAt: '2026-10-20T15:00:00.000Z',
  editedAt: null,
  categoryId: '14',
  category: 'General Discussion',
  authorId: '1',
  authorName: 'Ava Rahimi',
};
const found = (overrides = {}) => ({ status: 200, body: { post: { ...post, ...overrides } } });

describe('Forum post page', () => {
  it('shows the whole post with its category, author, date and views', async () => {
    const fetchMock = mockFetch(signedOut, found());
    renderApp('/forum/posts/8');

    expect(await screen.findByRole('heading', { level: 1, name: 'Best tea shops in the GTA' })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/forum/posts/8');
    const article = screen.getByRole('article');
    expect(article).toHaveTextContent('General Discussion');
    expect(article).toHaveTextContent('Ava Rahimi');
    expect(article).toHaveTextContent('4 views');
    expect(article).toHaveTextContent('Loose leaf and saffron.');
    expect(article).not.toHaveTextContent('Edited');
    expect(screen.getByRole('link', { name: 'Back to General Discussion' })).toHaveAttribute('href', '/forum/categories/14');
  });

  it('shows markup in the post as plain text', async () => {
    mockFetch(signedOut, found({ content: '<img src=x onerror="alert(1)">' }));
    renderApp('/forum/posts/8');

    expect(await screen.findByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(screen.getByRole('article').querySelector('img')).toBeNull();
  });

  it('says when the post was edited, and names a former member', async () => {
    mockFetch(signedOut, found({ editedAt: '2026-10-21T15:00:00.000Z', authorId: null, authorName: null, views: 1 }));
    renderApp('/forum/posts/8');

    const article = await screen.findByRole('article');
    expect(article).toHaveTextContent('Former member');
    expect(article).toHaveTextContent('Edited');
    expect(article).toHaveTextContent('1 view');
  });

  it('says so when the post does not exist', async () => {
    mockFetch(signedOut, { status: 404, body: { error: 'Post not found.' } });
    renderApp('/forum/posts/999');

    expect(await screen.findByRole('heading', { level: 1, name: 'Post not found' })).toBeInTheDocument();
  });

  // REQ-4.2.1
  it('explains a failure in plain words', async () => {
    mockFetch(signedOut, { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/forum/posts/8');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('is opened from the title of a post in its category', async () => {
    mockFetch(signedOut, { status: 200, body: forumPostPage([{ id: '8', title: post.title, excerpt: 'x', createdAt: post.createdAt, views: 4, authorId: null, authorName: null }]) }, found());
    renderApp('/forum/categories/14');

    await userEvent.click(await screen.findByRole('link', { name: post.title }));
    expect(await screen.findByRole('heading', { level: 1, name: post.title })).toBeInTheDocument();
  });
});
