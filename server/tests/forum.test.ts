import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();

const categoryId = async (name: string) =>
  (await pool.query("SELECT id FROM categories WHERE type = 'forum' AND name = $1", [name])).rows[0].id as string;

// The post is made the given number of minutes ago, so a larger number is older
async function addPost(overrides: Record<string, unknown> = {}, category = 'General Discussion', minutesAgo = 1) {
  const values = { title: 'A post', content: 'Some words.', ...overrides };
  const columns = Object.keys(values);
  const { rows } = await pool.query(
    `INSERT INTO forum_posts (category_id, created_at, ${columns.join(', ')})
     VALUES ($1, now() - make_interval(mins => $2::int), ${columns.map((_, i) => `$${i + 3}`).join(', ')})
     RETURNING id`,
    [await categoryId(category), minutesAgo, ...Object.values(values)],
  );
  return rows[0].id as string;
}

const posts = async (category: string, query = '') =>
  request(app).get(`/api/forum/categories/${await categoryId(category)}/posts${query}`);
const titles = (res: request.Response) => res.body.posts.map((p: { title: string }) => p.title);

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// REQ-3.5.2
describe('GET /api/forum/categories/:id/posts', () => {
  it('lists a post with its title, an excerpt, author, date and views, and names the category', async () => {
    const { rows: users } = await pool.query(
      "INSERT INTO users (email, password_hash, first_name, last_name) VALUES ('a@test.com', 'x', 'Ava', 'Rahimi') RETURNING id",
    );
    const id = await addPost({ title: 'Tea shops', content: 'Where do you go?', user_id: users[0].id, views: 7 });

    const res = await posts('General Discussion');

    expect(res.status).toBe(200);
    expect(res.body.category).toEqual({ id: expect.any(String), name: 'General Discussion' });
    expect(res.body.posts).toEqual([
      {
        id,
        title: 'Tea shops',
        excerpt: 'Where do you go?',
        createdAt: expect.any(String),
        views: 7,
        authorId: users[0].id,
        authorName: 'Ava Rahimi',
      },
    ]);
  });

  it('only lists the posts of the category asked for', async () => {
    await addPost({ title: 'General one' }, 'General Discussion');
    await addPost({ title: 'Question one' }, 'Q&A');

    expect(titles(await posts('General Discussion'))).toEqual(['General one']);
    expect(titles(await posts('Q&A'))).toEqual(['Question one']);
    expect(titles(await posts('Event Planning'))).toEqual([]);
  });

  it('puts the newest post first', async () => {
    await addPost({ title: 'Old' }, 'General Discussion', 30);
    await addPost({ title: 'New' }, 'General Discussion', 1);
    await addPost({ title: 'Middle' }, 'General Discussion', 10);

    expect(titles(await posts('General Discussion'))).toEqual(['New', 'Middle', 'Old']);
  });

  it('shows approved and flagged posts, never hidden ones', async () => {
    await addPost({ title: 'Fine', status: 'approved' }, 'General Discussion', 3);
    await addPost({ title: 'Reported', status: 'flagged' }, 'General Discussion', 2);
    await addPost({ title: 'Removed', status: 'hidden' }, 'General Discussion', 1);

    const res = await posts('General Discussion');

    expect(titles(res)).toEqual(['Reported', 'Fine']);
    expect(res.body.total).toBe(2);
  });

  // REQ-3.2.4
  it('shows a post whose author deleted their account, without a name', async () => {
    await addPost({ title: 'Orphan' });

    const res = await posts('General Discussion');

    expect(res.body.posts[0]).toMatchObject({ title: 'Orphan', authorId: null, authorName: null });
  });

  it('cuts a long post to a 200 character excerpt', async () => {
    await addPost({ content: 'x'.repeat(500) });

    const res = await posts('General Discussion');

    expect(res.body.posts[0].excerpt).toHaveLength(200);
  });

  it('answers with an empty list for a category without posts', async () => {
    const res = await posts('Cultural Exchange');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ posts: [], page: 1, pageSize: 15, total: 0, totalPages: 1 });
  });

  it('returns user text as it was written, to be escaped by the page', async () => {
    await addPost({ title: '<script>alert(1)</script>', content: '<img src=x onerror=alert(1)>' });

    const res = await posts('General Discussion');

    expect(res.body.posts[0]).toMatchObject({ title: '<script>alert(1)</script>', excerpt: '<img src=x onerror=alert(1)>' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('is open to everyone', async () => {
    expect((await posts('Q&A')).status).toBe(200);
  });

  // REQ-4.1.1 the id only ever travels as a query parameter
  it.each(['abc', '0', '999999', '1;SELECT 1', "1' OR '1'='1"])('says the category %p is not found', async (id) => {
    const res = await request(app).get(`/api/forum/categories/${encodeURIComponent(id)}/posts`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Forum category not found.' });
  });

  it('does not list the posts of a business or event category', async () => {
    const { rows } = await pool.query("SELECT id FROM categories WHERE type = 'business' LIMIT 1");

    const res = await request(app).get(`/api/forum/categories/${rows[0].id}/posts`);

    expect(res.status).toBe(404);
  });
});

// REQ-3.7.9
describe('Forum post pagination', () => {
  async function addMany(count: number) {
    for (let i = 1; i <= count; i++) await addPost({ title: `Post ${String(i).padStart(2, '0')}` }, 'General Discussion', i);
  }

  it('shows 15 posts on the first page and says how many there are in all', async () => {
    await addMany(32);

    const res = await posts('General Discussion');

    expect(res.body.posts).toHaveLength(15);
    expect(res.body).toMatchObject({ page: 1, pageSize: 15, total: 32, totalPages: 3 });
    expect(titles(res)[0]).toBe('Post 01');
  });

  it('shows the next posts on the next page, and the rest on the last', async () => {
    await addMany(32);

    const second = await posts('General Discussion', '?page=2');
    const third = await posts('General Discussion', '?page=3');

    expect(titles(second)[0]).toBe('Post 16');
    expect(second.body.posts).toHaveLength(15);
    expect(titles(third)).toEqual(['Post 31', 'Post 32']);
  });

  it('never repeats a post on two pages', async () => {
    await addMany(20);

    const all = [...titles(await posts('General Discussion')), ...titles(await posts('General Discussion', '?page=2'))];

    expect(new Set(all).size).toBe(20);
  });

  it('answers a page past the end with an empty list and the real page count', async () => {
    await addMany(3);

    const res = await posts('General Discussion', '?page=5');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ posts: [], page: 5, total: 3, totalPages: 1 });
  });

  it.each(['0', '-1', 'x', '1.5', '1&page=2'])('refuses the page %p', async (page) => {
    const res = await posts('General Discussion', `?page=${encodeURIComponent(page)}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Choose a page number from 1 upward.' });
  });
});
