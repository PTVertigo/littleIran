import request from 'supertest';
import { browser, sessionToken } from './browser';
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

// REQ-3.7.3 search and REQ-3.7.6 filter by category, across all forum categories
describe('GET /api/forum/posts', () => {
  const search = (query: string) => request(app).get(`/api/forum/posts${query}`);

  beforeEach(async () => {
    await addPost({ title: 'Best saffron tea', content: 'Where to buy it?' }, 'General Discussion', 3);
    await addPost({ title: 'Nowruz plans', content: 'Anyone hosting a haft-sin table with saffron sweets?' }, 'Event Planning', 2);
    await addPost({ title: 'Calligraphy books', content: 'Recommendations please.' }, 'Cultural Exchange', 1);
  });

  it('lists every post newest first, with the category of each', async () => {
    const res = await search('');

    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Calligraphy books', 'Nowruz plans', 'Best saffron tea']);
    expect(res.body.posts[0]).toMatchObject({ category: 'Cultural Exchange', categoryId: expect.any(String), excerpt: 'Recommendations please.' });
    expect(res.body).toMatchObject({ page: 1, pageSize: 15, total: 3, totalPages: 1 });
  });

  it('finds words in the title or in the content, in any category', async () => {
    const res = await search('?search=saffron');

    expect(titles(res)).toEqual(['Nowruz plans', 'Best saffron tea']);
    expect(res.body.posts.map((p: { category: string }) => p.category)).toEqual(['Event Planning', 'General Discussion']);
  });

  it('ignores case and needs every word', async () => {
    expect(titles(await search('?search=SAFFRON%20tea'))).toEqual(['Best saffron tea']);
    expect(titles(await search('?search=saffron%20calligraphy'))).toEqual([]);
  });

  it('filters by category name, ignoring case', async () => {
    expect(titles(await search('?category=event%20planning'))).toEqual(['Nowruz plans']);
    expect(titles(await search('?category=Q%26A'))).toEqual([]);
  });

  it('combines a search with a category', async () => {
    expect(titles(await search('?search=saffron&category=General%20Discussion'))).toEqual(['Best saffron tea']);
  });

  it('never returns hidden posts, but keeps flagged ones', async () => {
    await addPost({ title: 'Hidden saffron', status: 'hidden' });
    await addPost({ title: 'Flagged saffron', status: 'flagged' });

    expect(titles(await search('?search=saffron'))).toEqual(['Flagged saffron', 'Nowruz plans', 'Best saffron tea']);
  });

  it('treats % and _ as plain characters', async () => {
    await addPost({ title: '100% sure' });

    expect(titles(await search('?search=100%25'))).toEqual(['100% sure']);
    expect(titles(await search('?search=%25'))).toEqual(['100% sure']);
    expect(titles(await search('?search=_'))).toEqual([]);
  });

  // API-004 style
  it("answers 200 and finds nothing for an injection attempt, leaving the table intact", async () => {
    const res = await search(`?search=${encodeURIComponent("'; DROP TABLE forum_posts;--")}`);

    expect(res.status).toBe(200);
    expect(res.body.posts).toEqual([]);
    expect(res.body.total).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM forum_posts')).rows[0].n).toBe(3);
  });

  it('pages the results 15 at a time', async () => {
    for (let i = 1; i <= 15; i++) await addPost({ title: `Extra ${i}` }, 'Q&A', 10 + i);

    const second = await search('?page=2');

    expect(second.body).toMatchObject({ page: 2, total: 18, totalPages: 2 });
    expect(second.body.posts).toHaveLength(3);
  });

  it.each([
    ['?search=a&search=b', 'Search for a single phrase.'],
    [`?search=${'x'.repeat(101)}`, 'Search for at most 100 characters.'],
    ['?category=a&category=b', 'Choose a single category.'],
    ['?page=0', 'Choose a page number from 1 upward.'],
  ])('refuses %p', async (query, error) => {
    const res = await search(query);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
  });
});

// REQ-3.5 / FE-005 create a forum post
describe('POST /api/forum/posts', () => {
  let token: string;
  let userId: string;
  let generalId: string;

  // Pass null to send the request with no session at all
  const create = (body: object, session: string | null = token) => browser(app, session ?? undefined).post('/api/forum/posts').send(body);
  const valid = (changes: object = {}) => ({ title: 'Best tea shops', categoryId: generalId, content: 'Where do you go?', ...changes });
  const count = async () => (await pool.query('SELECT count(*)::int AS n FROM forum_posts')).rows[0].n as number;

  beforeEach(async () => {
    const registered = await browser(app).post('/api/users')
      .send({ email: 'poster@test.com', password: 'Test123@', firstName: 'Pari', lastName: 'Poster' });
    userId = registered.body.id;
    token = sessionToken(await browser(app).post('/api/auth/login').send({ email: 'poster@test.com', password: 'Test123@' }))!;
    generalId = await categoryId('General Discussion');
  });

  it('creates the post and answers 201', async () => {
    const res = await create(valid());

    expect(res.status).toBe(201);
    expect(res.body.post).toEqual({ id: expect.any(String), title: 'Best tea shops', categoryId: generalId, status: 'approved' });
  });

  it('stores the author, the category and the text, with no views', async () => {
    const id = (await create(valid({ title: '  Padded title  ', content: ' Padded content ' }))).body.post.id;

    const { rows } = await pool.query('SELECT user_id, category_id, title, content, status, views, edited_at FROM forum_posts WHERE id = $1', [id]);

    expect(rows[0]).toEqual({
      user_id: userId,
      category_id: generalId,
      title: 'Padded title',
      content: 'Padded content',
      status: 'approved',
      views: 0,
      edited_at: null,
    });
  });

  it('shows the new post first in its category, under the author\'s name', async () => {
    await addPost({ title: 'Older post' }, 'General Discussion', 30);
    await create(valid({ title: 'Fresh post' }));

    const res = await posts('General Discussion');

    expect(titles(res)).toEqual(['Fresh post', 'Older post']);
    expect(res.body.posts[0]).toMatchObject({ authorId: userId, authorName: 'Pari Poster' });
  });

  it('answers 401 without a session, and stores nothing', async () => {
    const res = await create(valid(), null);

    expect(res.status).toBe(401);
    expect(await count()).toBe(0);
  });

  it('answers 403 without the CSRF header, and stores nothing', async () => {
    const res = await request(app).post('/api/forum/posts').set('Cookie', `sid=${token}`).send(valid());

    expect(res.status).toBe(403);
    expect(await count()).toBe(0);
  });

  it('answers 400 with a message per field, and stores nothing', async () => {
    const res = await create({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      title: 'Enter a title for your post.',
      categoryId: 'Choose a category.',
      content: 'Write your post.',
    });
    expect(await count()).toBe(0);
  });

  it('refuses a business, an event and a missing category', async () => {
    const business = (await pool.query("SELECT id FROM categories WHERE type = 'business' LIMIT 1")).rows[0].id;
    const event = (await pool.query("SELECT id FROM categories WHERE type = 'event' LIMIT 1")).rows[0].id;

    for (const id of [business, event, '999999']) {
      const res = await create(valid({ categoryId: id }));
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual({ categoryId: 'Choose a category.' });
    }
    expect(await count()).toBe(0);
  });

  it('refuses a title or post that is too long', async () => {
    const res = await create(valid({ title: 'a'.repeat(151), content: 'a'.repeat(5001) }));

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['content', 'title']);
    expect(await count()).toBe(0);
  });

  // REQ-4.1.1 SQL in the text is stored as text
  it('stores SQL in the title as plain text', async () => {
    const title = "'); DROP TABLE forum_posts;--";
    const res = await create(valid({ title }));

    expect(res.status).toBe(201);
    expect((await pool.query('SELECT title FROM forum_posts WHERE id = $1', [res.body.post.id])).rows[0].title).toBe(title);
  });

  // REQ-4.1.3 / SEC-002 markup is stored and returned as typed; the page escapes it
  it('keeps markup as plain text', async () => {
    await create(valid({ title: '<script>alert(1)</script>', content: '<img src=x onerror=alert(1)>' }));

    const res = await posts('General Discussion');

    expect(res.body.posts[0]).toMatchObject({ title: '<script>alert(1)</script>', excerpt: '<img src=x onerror=alert(1)>' });
  });

  it('ignores fields it does not know, such as the author or the status', async () => {
    const id = (await create(valid({ userId: '999', status: 'hidden', views: 50 }))).body.post.id;

    const { rows } = await pool.query('SELECT user_id, status, views FROM forum_posts WHERE id = $1', [id]);

    expect(rows[0]).toEqual({ user_id: userId, status: 'approved', views: 0 });
  });

  it('answers 400, not a server error, when the body is not JSON', async () => {
    const res = await browser(app, token).post('/api/forum/posts').set('Content-Type', 'application/json').send('{not json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Request body must be valid JSON.' });
  });
});
