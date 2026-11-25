// Milestone 3 (Weeks 7 to 9: forums, flags and comments, administrator approval), one test per case, so the
// milestone can be run and shown on its own. Every title starts with its test plan ID or requirement number,
// so a single case can be run by itself:
//   npm run test:m3:api -- -t "REQ-3.8.2"
// The same behaviour is tested in more depth in the feature test files; this file is the traceable set.
import request from 'supertest';
import { browser, sessionToken } from './browser';
import { createApp } from '../src/app';
import { pool } from '../src/db';
import { validateForumPost } from '../src/forum-validation';

const app = createApp();

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

// Emptying the users also empties everything that points at them: posts, comments, flags and submissions
beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

async function signIn(email: string, role: 'user' | 'admin' = 'user') {
  const registered = await browser(app).post('/api/users').send({ email, password: 'Test123@', firstName: 'Sara', lastName: 'Ahmadi' });
  await pool.query('UPDATE users SET role = $2 WHERE id = $1', [registered.body.id, role]);
  const token = sessionToken(await browser(app).post('/api/auth/login').send({ email, password: 'Test123@' }))!;
  return browser(app, token);
}
type Client = Awaited<ReturnType<typeof signIn>>;

const categoryId = async (type: 'business' | 'event' | 'forum', name: string) =>
  (await pool.query('SELECT id FROM categories WHERE type = $1 AND name = $2', [type, name])).rows[0].id as string;

async function createPost(member: Client, title: string, content = 'Some words.', category = 'General Discussion') {
  const res = await member.post('/api/forum/posts').send({ title, content, categoryId: await categoryId('forum', category) });
  return res.body.post.id as string;
}

const businessForm = async (changes: object = {}) => ({
  name: 'Saffron House',
  categoryId: await categoryId('business', 'Restaurant'),
  description: 'Tea and sweets.',
  street: '1 Main Street',
  city: 'Toronto',
  postalCode: 'M5V 2T6',
  phone: '416-555-0100',
  email: 'info@saffron.example.com',
  hours: [{ day: 1, opens: '09:00', closes: '17:00' }],
  ...changes,
});

const eventForm = async (changes: object = {}) => ({
  title: 'Nowruz Gala',
  categoryId: await categoryId('event', 'Festival'),
  description: 'A new year celebration.',
  location: 'Hamilton',
  date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  startTime: '18:00',
  endTime: '21:00',
  organizerName: 'Sara Ahmadi',
  organizerContact: 'sara@example.com',
  ...changes,
});

const submitBusiness = async (member: Client) => (await member.post('/api/businesses').send(await businessForm())).body.business.id as string;
const submitEvent = async (member: Client) => (await member.post('/api/events').send(await eventForm())).body.event.id as string;

// ---------------------------------------------------------------------------------------------------------
// Unit testing (Jest)
// ---------------------------------------------------------------------------------------------------------
describe('Unit tests', () => {
  // UT-007 is this project's own ID, following UT-001 to UT-005 in the test plan
  it('UT-007 forum post validation: a post with missing fields returns one error per field', () => {
    const { errors, value } = validateForumPost({});

    expect(value).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual(['categoryId', 'content', 'title']);
  });
});

// ---------------------------------------------------------------------------------------------------------
// API testing (Jest + supertest): Week 7, the forum
// ---------------------------------------------------------------------------------------------------------
describe('Forum', () => {
  it('REQ-3.5.1 view forum categories: the five categories are listed to everyone', async () => {
    const res = await request(app).get('/api/categories?type=forum');

    expect(res.status).toBe(200);
    expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual([
      'General Discussion', 'Business Recommendations', 'Event Planning', 'Cultural Exchange', 'Q&A',
    ]);
  });

  it('REQ-3.5 create a forum post: a member gets 201 and a visitor gets 401', async () => {
    const member = await signIn('member@test.com');
    const body = { title: 'Best tea shops', content: 'Where do you go?', categoryId: await categoryId('forum', 'General Discussion') };

    const res = await member.post('/api/forum/posts').send(body);

    expect(res.status).toBe(201);
    expect((await browser(app).post('/api/forum/posts').send(body)).status).toBe(401);
  });

  it('REQ-3.5.2 view forum posts: a category lists only its own posts', async () => {
    const member = await signIn('member@test.com');
    await createPost(member, 'General post');
    await createPost(member, 'A question', 'Some words.', 'Q&A');

    const res = await request(app).get(`/api/forum/categories/${await categoryId('forum', 'Q&A')}/posts`);

    expect(res.status).toBe(200);
    expect(res.body.posts.map((p: { title: string }) => p.title)).toEqual(['A question']);
  });

  it('REQ-3.7.9 forum post pagination: 15 posts on the first page and the rest on the second', async () => {
    const member = await signIn('member@test.com');
    for (let i = 1; i <= 16; i++) await createPost(member, `Post ${i}`);
    const url = `/api/forum/categories/${await categoryId('forum', 'General Discussion')}/posts`;

    const first = await request(app).get(url);
    const second = await request(app).get(`${url}?page=2`);

    expect(first.body).toMatchObject({ page: 1, pageSize: 15, total: 16, totalPages: 2 });
    expect(first.body.posts).toHaveLength(15);
    expect(second.body.posts).toHaveLength(1);
  });

  it('REQ-3.7.3 search forum posts: words in the title or content match, and each result names its category', async () => {
    const member = await signIn('member@test.com');
    await createPost(member, 'Saffron prices');
    await createPost(member, 'Shopping', 'Where is good saffron?', 'Q&A');
    await createPost(member, 'Parking downtown');

    const res = await request(app).get('/api/forum/posts').query({ search: 'saffron' });

    expect(res.status).toBe(200);
    expect(res.body.posts.map((p: { title: string; category: string }) => [p.title, p.category]).sort()).toEqual([
      ['Saffron prices', 'General Discussion'],
      ['Shopping', 'Q&A'],
    ]);
  });

  it('REQ-3.7.6 filter forum posts by category: only that category is returned', async () => {
    const member = await signIn('member@test.com');
    await createPost(member, 'General post');
    await createPost(member, 'A question', 'Some words.', 'Q&A');

    const res = await request(app).get('/api/forum/posts').query({ category: 'Q&A' });

    expect(res.body.posts.map((p: { title: string }) => p.title)).toEqual(['A question']);
  });

  it('REQ-3.5.2 open a single post: the whole post is returned and counts one view', async () => {
    const member = await signIn('member@test.com');
    const id = await createPost(member, 'Long read', 'The full text of the post.');

    const res = await request(app).get(`/api/forum/posts/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({ title: 'Long read', content: 'The full text of the post.', views: 1 });
  });

  // -------------------------------------------------------------------------------------------------------
  // Week 8, comments and flags
  // -------------------------------------------------------------------------------------------------------
  it('REQ-3.5 comments and replies: a reply is stored under its comment', async () => {
    const member = await signIn('member@test.com');
    const id = await createPost(member, 'Discuss');
    const comment = await member.post(`/api/forum/posts/${id}/comments`).send({ content: 'First comment' });

    const reply = await member.post(`/api/forum/posts/${id}/comments`).send({ content: 'A reply', parentId: comment.body.comment.id });

    expect(reply.status).toBe(201);
    const list = await request(app).get(`/api/forum/posts/${id}/comments`);
    expect(list.body.comments.map((c: { content: string; parentId: string | null }) => [c.content, c.parentId])).toEqual([
      ['First comment', null],
      ['A reply', comment.body.comment.id],
    ]);
  });

  it('REQ-3.5 flag a post: the report is saved and the post is marked flagged', async () => {
    const member = await signIn('member@test.com');
    const id = await createPost(member, 'Advertising');

    const res = await member.post(`/api/forum/posts/${id}/flag`).send({ reason: 'Spam' });

    expect(res.status).toBe(201);
    const { rows } = await pool.query('SELECT p.status, f.reason FROM forum_posts p JOIN forum_flags f ON f.post_id = p.id');
    expect(rows).toEqual([{ status: 'flagged', reason: 'Spam' }]);
  });
});

// ---------------------------------------------------------------------------------------------------------
// API testing: Week 9, administrator approval
// ---------------------------------------------------------------------------------------------------------
describe('Administrator approval', () => {
  let member: Client;
  let admin: Client;

  beforeEach(async () => {
    member = await signIn('member@test.com');
    admin = await signIn('admin@test.com', 'admin');
  });

  // F4.2, NF 4.1.4 · POST /api/admin/approve as a non-admin user · expected: 403 Forbidden.
  // The test plan's address is tried as written, then the real approval address, which must change nothing.
  it('API-005 admin approval authorization: a non-admin gets 403 and nothing is approved', async () => {
    const id = await submitBusiness(member);

    expect((await member.post('/api/admin/approve').send({})).status).toBe(403);
    expect((await member.post(`/api/admin/businesses/${id}/approve`).send({})).status).toBe(403);

    const { rows } = await pool.query('SELECT status FROM businesses');
    expect(rows).toEqual([{ status: 'pending' }]);
  });

  it('REQ-3.8.1 view pending submissions: the administrator sees pending businesses and events', async () => {
    await submitBusiness(member);
    await submitEvent(member);

    const res = await admin.get('/api/admin/submissions');

    expect(res.status).toBe(200);
    expect(res.body.businesses.map((b: { title: string }) => b.title)).toEqual(['Saffron House']);
    expect(res.body.events.map((e: { title: string }) => e.title)).toEqual(['Nowruz Gala']);
  });

  it('REQ-3.8.2 approve a business: it then appears in the public directory', async () => {
    const id = await submitBusiness(member);

    const res = await admin.post(`/api/admin/businesses/${id}/approve`).send({});

    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/businesses/${id}`)).status).toBe(200);
  });

  it('REQ-3.8.3 reject a business: a reason is required and the listing stays unpublished', async () => {
    const id = await submitBusiness(member);

    expect((await admin.post(`/api/admin/businesses/${id}/reject`).send({})).status).toBe(400);
    const res = await admin.post(`/api/admin/businesses/${id}/reject`).send({ reason: 'Add the full address.' });

    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/businesses/${id}`)).status).toBe(404);
  });

  it('REQ-3.8.4 approve an event: it then appears on the public events page', async () => {
    const id = await submitEvent(member);

    const res = await admin.post(`/api/admin/events/${id}/approve`).send({});

    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/events/${id}`)).status).toBe(200);
  });

  it('REQ-3.8.5 reject an event: a reason is required and the event stays unpublished', async () => {
    const id = await submitEvent(member);

    expect((await admin.post(`/api/admin/events/${id}/reject`).send({})).status).toBe(400);
    const res = await admin.post(`/api/admin/events/${id}/reject`).send({ reason: 'Name the venue.' });

    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/events/${id}`)).status).toBe(404);
  });

  // -------------------------------------------------------------------------------------------------------
  // Member submissions
  // -------------------------------------------------------------------------------------------------------
  it('REQ-3.6.1 view own submissions: a member sees their businesses and events with the status', async () => {
    await submitBusiness(member);
    await submitEvent(member);

    const res = await member.get('/api/submissions');

    expect(res.status).toBe(200);
    expect(res.body.businesses).toMatchObject([{ title: 'Saffron House', status: 'pending' }]);
    expect(res.body.events).toMatchObject([{ title: 'Nowruz Gala', status: 'pending' }]);
  });

  it('REQ-3.6.2 receive feedback: the member sees the reason for a rejection', async () => {
    const id = await submitBusiness(member);
    await admin.post(`/api/admin/businesses/${id}/reject`).send({ reason: 'Add the full address.' });

    const res = await member.get('/api/submissions');

    expect(res.body.businesses).toMatchObject([{ status: 'rejected', rejectionReason: 'Add the full address.' }]);
  });

  it('REQ-3.6.3 resubmit: a rejected business goes back to pending with the reason cleared', async () => {
    const id = await submitBusiness(member);
    await admin.post(`/api/admin/businesses/${id}/reject`).send({ reason: 'Add the full address.' });

    const res = await member.put(`/api/businesses/${id}`).send(await businessForm({ street: '25 Main Street, Unit 3' }));

    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT status, rejection_reason, street FROM businesses');
    expect(rows).toEqual([{ status: 'pending', rejection_reason: null, street: '25 Main Street, Unit 3' }]);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Security testing at the API level (the XSS scan SEC-002 is run separately in OWASP ZAP)
// ---------------------------------------------------------------------------------------------------------
describe('Security tests', () => {
  // NF 4.1.3 · input: `<script>alert('xss')</script>` · the API keeps it as plain JSON text, never as HTML
  it("UT-004 XSS: <script>alert('xss')</script> in a forum post comes back as plain JSON text", async () => {
    const script = "<script>alert('xss')</script>";
    const id = await createPost(await signIn('member@test.com'), script, script);

    const res = await request(app).get(`/api/forum/posts/${id}`);

    expect(res.type).toBe('application/json');
    expect(res.body.post).toMatchObject({ title: script, content: script });
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  });

  it('REQ-4.1.1 SQL injection: a forum search with an injection attempt is treated as plain words', async () => {
    await createPost(await signIn('member@test.com'), 'Still here');

    const res = await request(app).get('/api/forum/posts').query({ search: "'; DROP TABLE--" });

    expect(res.status).toBe(200);
    expect(res.body.posts).toEqual([]);
    expect((await pool.query('SELECT count(*)::int AS n FROM forum_posts')).rows[0].n).toBe(1);
  });
});
