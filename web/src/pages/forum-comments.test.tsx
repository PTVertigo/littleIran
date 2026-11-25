import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockFetch, renderApp } from '../test/render';

const signedOut = { status: 401, body: { error: 'Please log in to continue.' } };
const signedIn = {
  status: 200,
  body: {
    user: { id: '1', email: 'sara@example.com', firstName: 'Sara', lastName: 'Ahmadi', role: 'user', status: 'active', createdAt: '2026-10-01T12:00:00.000Z' },
  },
};
const post = {
  status: 200,
  body: {
    post: {
      id: '8', title: 'Best tea shops', content: 'Where?', views: 2, createdAt: '2026-10-20T15:00:00.000Z', editedAt: null,
      categoryId: '14', category: 'General Discussion', authorId: '2', authorName: 'Ava Rahimi',
    },
  },
};
const base = { createdAt: '2026-10-21T15:00:00.000Z', authorId: '2' };
const parent = { ...base, id: '1', parentId: null, content: 'Try Tehran Tea', authorName: 'Ava Rahimi' };
const reply = { ...base, id: '2', parentId: '1', content: 'Thanks!', authorName: null, authorId: null };
const comments = (list: object[]) => ({ status: 200, body: { comments: list } });
const created = { status: 201, body: { comment: { id: '3', parentId: null, content: 'x' } } };

describe('Comments on a forum post', () => {
  it('lists comments with their replies under them, and a count', async () => {
    mockFetch(signedOut, post, comments([parent, reply]));
    renderApp('/forum/posts/8');

    expect(await screen.findByRole('heading', { level: 2, name: 'Comments (2)' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    const first = items.find((li) => li.textContent?.includes('Try Tehran Tea'))!;
    expect(within(first).getByText('Thanks!')).toBeInTheDocument();
    expect(within(first).getByText(/Former member/)).toBeInTheDocument();
  });

  it('says there are no comments yet', async () => {
    mockFetch(signedOut, post, comments([]));
    renderApp('/forum/posts/8');

    expect(await screen.findByText('No comments yet. Be the first to reply.')).toBeInTheDocument();
  });

  it('shows markup in a comment as plain text', async () => {
    mockFetch(signedOut, post, comments([{ ...parent, content: '<b onmouseover="x()">bold</b>' }]));
    renderApp('/forum/posts/8');

    expect(await screen.findByText('<b onmouseover="x()">bold</b>')).toBeInTheDocument();
    expect(document.querySelector('main b')).toBeNull();
  });

  it('asks a visitor who is not logged in to log in, with no form', async () => {
    mockFetch(signedOut, post, comments([parent]));
    renderApp('/forum/posts/8');

    await screen.findByText('Try Tehran Tea');
    expect(screen.queryByLabelText('Add a comment')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reply/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('main')).getAllByRole('link', { name: 'Log in' })).toHaveLength(2);
  });

  it('posts a comment, sends it with the CSRF header route and shows the new list', async () => {
    const fetchMock = mockFetch(signedIn, post, comments([]), created, comments([{ ...parent, content: 'Hello' }]));
    renderApp('/forum/posts/8');

    await userEvent.type(await screen.findByLabelText('Add a comment'), '  Hello  ');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(await screen.findByRole('heading', { name: 'Comments (1)' })).toBeInTheDocument();
    const [path, init] = fetchMock.mock.calls[3];
    expect(path).toBe('/api/forum/posts/8/comments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ content: 'Hello' });
    expect(screen.getByLabelText('Add a comment')).toHaveValue('');
  });

  it('will not send an empty comment', async () => {
    const fetchMock = mockFetch(signedIn, post, comments([]));
    renderApp('/forum/posts/8');

    await userEvent.click(await screen.findByRole('button', { name: 'Post comment' }));

    expect(screen.getByLabelText('Add a comment')).toHaveAccessibleDescription(/Write your comment\./);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps what was typed and explains a failure', async () => {
    mockFetch(signedIn, post, comments([]), { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/forum/posts/8');

    await userEvent.type(await screen.findByLabelText('Add a comment'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByLabelText('Add a comment')).toHaveValue('Hello');
  });

  it('replies to a comment with the id of the comment', async () => {
    const fetchMock = mockFetch(signedIn, post, comments([parent]), { status: 201, body: { comment: { id: '4' } } }, comments([parent, reply]));
    renderApp('/forum/posts/8');

    await userEvent.click(await screen.findByRole('button', { name: 'Reply to Ava Rahimi' }));
    await userEvent.type(screen.getByLabelText('Reply to Ava Rahimi'), 'Thanks!');
    await userEvent.click(screen.getByRole('button', { name: 'Post reply' }));

    expect(await screen.findByRole('heading', { name: 'Comments (2)' })).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ content: 'Thanks!', parentId: '1' });
    expect(screen.queryByLabelText('Reply to Ava Rahimi')).not.toBeInTheDocument();
  });

  it('can cancel a reply', async () => {
    mockFetch(signedIn, post, comments([parent]));
    renderApp('/forum/posts/8');

    await userEvent.click(await screen.findByRole('button', { name: 'Reply to Ava Rahimi' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Reply to Ava Rahimi')).not.toBeInTheDocument();
  });
});

describe('Reporting a forum post', () => {
  it('asks a visitor who is not logged in to log in', async () => {
    mockFetch(signedOut, post, comments([]));
    renderApp('/forum/posts/8');

    expect(await screen.findByText(/to report this post\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report this post' })).not.toBeInTheDocument();
  });

  it('sends the report with the reason and thanks the member', async () => {
    const fetchMock = mockFetch(signedIn, post, comments([]), { status: 201, body: { flagged: true } });
    renderApp('/forum/posts/8');

    await userEvent.click(await screen.findByRole('button', { name: 'Report this post' }));
    await userEvent.type(screen.getByLabelText('Why are you reporting it? (optional)'), ' Spam ');
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Thank you. The administrators will review this post.');
    const [path, init] = fetchMock.mock.calls[3];
    expect(path).toBe('/api/forum/posts/8/flag');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ reason: 'Spam' });
  });

  it('can be sent with no reason, and can be cancelled', async () => {
    const fetchMock = mockFetch(signedIn, post, comments([]), { status: 201, body: { flagged: true } });
    renderApp('/forum/posts/8');

    await userEvent.click(await screen.findByRole('button', { name: 'Report this post' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Report this post' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Report this post' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await screen.findByText(/administrators will review/);
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ reason: '' });
  });

  it('explains a failure and keeps the form', async () => {
    mockFetch(signedIn, post, comments([]), { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    renderApp('/forum/posts/8');

    await userEvent.click(await screen.findByRole('button', { name: 'Report this post' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByRole('button', { name: 'Send report' })).toBeInTheDocument();
  });
});
