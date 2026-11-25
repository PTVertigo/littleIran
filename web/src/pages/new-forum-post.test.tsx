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
const categories = {
  status: 200,
  body: { categories: [{ id: '14', name: 'General Discussion' }, { id: '15', name: 'Business Recommendations' }, { id: '18', name: 'Q&A' }] },
};
const created = { status: 201, body: { post: { id: '40', title: 'Best tea shops', categoryId: '18', status: 'approved' } } };

async function openForm(path = '/forum/posts/new', ...after: { status: number; body?: object }[]) {
  const fetchMock = mockFetch(signedIn, categories, ...after);
  renderApp(path);
  await screen.findByRole('heading', { level: 1, name: 'New forum post' });
  await screen.findByLabelText('Title');
  return fetchMock;
}

const field = (label: string | RegExp) => screen.getByLabelText(label);
const type = (label: string | RegExp, text: string) => userEvent.type(field(label), text);
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Publish post' }));

async function fillEverything() {
  await type('Title', 'Best tea shops');
  await userEvent.selectOptions(field('Category'), '18');
  await type('Post', 'Where do you go for saffron tea?');
}

// REQ-3.5 / FE-005 create a forum post
describe('New forum post page', () => {
  it('sends a visitor who is not logged in to the login page', async () => {
    mockFetch(signedOut);
    const router = renderApp('/forum/posts/new');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('asks for a title, a category and the post, with the forum categories from the server', async () => {
    const fetchMock = await openForm();

    for (const label of ['Title', 'Category', 'Post']) expect(field(label)).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/categories?type=forum');
    expect(within(field('Category')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Choose a category', 'General Discussion', 'Business Recommendations', 'Q&A',
    ]);
    expect(field('Post')).toHaveAccessibleDescription('Up to 5000 characters.');
  });

  it('starts with the category chosen when the link names one', async () => {
    await openForm('/forum/posts/new?category=15');

    expect(field('Category')).toHaveValue('15');
  });

  it('ignores a category in the address that does not exist', async () => {
    await openForm('/forum/posts/new?category=999');

    expect(field('Category')).toHaveValue('');
  });

  it('asks for every field, without sending anything, when it is empty', async () => {
    const fetchMock = await openForm();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the fields marked below and try again.');
    expect(field('Title')).toHaveAccessibleDescription('Enter a title for your post.');
    expect(field('Category')).toHaveAccessibleDescription('Choose a category.');
    expect(field('Post')).toHaveAccessibleDescription(/Write your post\./);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('publishes the post and shows a confirmation with a link to the category', async () => {
    const fetchMock = await openForm('/forum/posts/new', created);
    await fillEverything();

    await submit();

    expect(await screen.findByRole('heading', { level: 1, name: 'Post published' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Your post “Best tea shops” is now in Q&A.');
    expect(screen.getByRole('link', { name: 'See the posts in Q&A' })).toHaveAttribute('href', '/forum/categories/18');
    const [path, init] = fetchMock.mock.calls[2];
    expect(path).toBe('/api/forum/posts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ title: 'Best tea shops', categoryId: '18', content: 'Where do you go for saffron tea?' });
  });

  it('trims what was typed before sending it', async () => {
    const fetchMock = await openForm('/forum/posts/new', created);
    await fillEverything();
    await userEvent.clear(field('Title'));
    await type('Title', '   Best tea shops   ');

    await submit();

    await screen.findByRole('heading', { name: 'Post published' });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).title).toBe('Best tea shops');
  });

  it('writes another post with the same category and an empty form', async () => {
    await openForm('/forum/posts/new', created);
    await fillEverything();
    await submit();

    await userEvent.click(await screen.findByRole('button', { name: 'Write another post' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'New forum post' })).toBeInTheDocument();
    expect(field('Title')).toHaveValue('');
    expect(field('Post')).toHaveValue('');
    expect(field('Category')).toHaveValue('18');
  });

  it('shows the messages of the server next to the fields when it refuses the post', async () => {
    await openForm('/forum/posts/new', { status: 400, body: { errors: { categoryId: 'Choose a category.' } } });
    await fillEverything();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the fields marked below and try again.');
    expect(field('Category')).toHaveAccessibleDescription('Choose a category.');
    expect(field('Title')).toHaveValue('Best tea shops');
  });

  // REQ-4.2.1
  it('explains a failure in plain words and keeps what was typed', async () => {
    await openForm('/forum/posts/new', { status: 500, body: { error: 'Something went wrong. Please try again.' } });
    await fillEverything();

    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(field('Post')).toHaveValue('Where do you go for saffron tea?');
  });

  // REQ-4.4.4
  it('shows a loading indicator until the categories arrive', async () => {
    let finish: (value: object) => void = () => {};
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => signedIn.body })
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderApp('/forum/posts/new');

    expect(await screen.findByText('Loading the form')).toBeInTheDocument();

    finish({ ok: true, status: 200, json: async () => categories.body });
    expect(await screen.findByLabelText('Title')).toBeInTheDocument();
  });

  it('is reached from the forum page', async () => {
    mockFetch(signedIn, categories, categories);
    renderApp('/forum');

    await userEvent.click(await screen.findByRole('link', { name: 'New post' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'New forum post' })).toBeInTheDocument();
  });
});
