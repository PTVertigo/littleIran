import request from 'supertest';
import { browser, sessionToken } from './browser';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();

async function signIn(email: string, role: 'user' | 'admin') {
  const registered = await browser(app).post('/api/users').send({ email, password: 'Test123@', firstName: 'Ada', lastName: role });
  await pool.query('UPDATE users SET role = $2 WHERE id = $1', [registered.body.id, role]);
  const token = sessionToken(await browser(app).post('/api/auth/login').send({ email, password: 'Test123@' }))!;
  return { id: registered.body.id as string, token };
}

const categoryOf = async (type: string) => (await pool.query('SELECT id FROM categories WHERE type = $1 ORDER BY id LIMIT 1', [type])).rows[0].id as string;

async function addBusiness(status = 'pending', userId: string | null = null, name = 'Saffron House') {
  const { rows } = await pool.query(
    `INSERT INTO businesses (user_id, category_id, name, description, street, city, postal_code, phone, email, status, rejection_reason)
     VALUES ($1, $2, $3, 'Tea and sweets', '1 Main St', 'Toronto', 'M5V 2T6', '4165550100', 'a@b.ca', $4, $5) RETURNING id`,
    [userId, await categoryOf('business'), name, status, status === 'rejected' ? 'Old reason' : null],
  );
  return rows[0].id as string;
}

async function addEvent(status = 'pending', userId: string | null = null, title = 'Nowruz Gala') {
  const { rows } = await pool.query(
    `INSERT INTO events (user_id, category_id, title, description, location, starts_at, organizer_name, organizer_contact, status, rejection_reason)
     VALUES ($1, $2, $3, 'Celebrate', 'Hamilton', now() + interval '10 days', 'Org', 'org@x.ca', $4, $5) RETURNING id`,
    [userId, await categoryOf('event'), title, status, status === 'rejected' ? 'Old reason' : null],
  );
  return rows[0].id as string;
}

const statusOf = async (table: 'businesses' | 'events', id: string) =>
  (await pool.query(`SELECT status, rejection_reason FROM ${table} WHERE id = $1`, [id])).rows[0] as { status: string; rejection_reason: string | null };

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await pool.query('DELETE FROM businesses');
  await pool.query('DELETE FROM events');
});

afterAll(async () => {
  await pool.end();
});

describe('Administrator endpoints', () => {
  let admin: { id: string; token: string };
  let member: { id: string; token: string };

  const get = (path: string, token: string | null) => browser(app, token ?? undefined).get(path);
  const post = (path: string, token: string | null, body: object = {}) => browser(app, token ?? undefined).post(path).send(body);

  beforeEach(async () => {
    admin = await signIn('admin@test.com', 'admin');
    member = await signIn('member@test.com', 'user');
  });

  // API-005
  describe('who may use them', () => {
    it.each([
      ['get', '/api/admin/submissions'],
      ['post', '/api/admin/businesses/1/approve'],
      ['post', '/api/admin/businesses/1/reject'],
      ['post', '/api/admin/events/1/approve'],
      ['post', '/api/admin/events/1/reject'],
    ])('answers 403 to a member who is not an administrator: %s %s', async (method, path) => {
      const res = method === 'get' ? await get(path, member.token) : await post(path, member.token, { reason: 'x' });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'You do not have permission to do that.' });
    });

    it('answers 401 to a visitor with no session', async () => {
      expect((await get('/api/admin/submissions', null)).status).toBe(401);
      expect((await post('/api/admin/businesses/1/approve', null)).status).toBe(401);
    });

    it('answers 403 and changes nothing when a member tries to approve', async () => {
      const id = await addBusiness();

      await post(`/api/admin/businesses/${id}/approve`, member.token);

      expect((await statusOf('businesses', id)).status).toBe('pending');
    });

    it('needs the CSRF header on a decision', async () => {
      const id = await addBusiness();

      const res = await request(app).post(`/api/admin/businesses/${id}/approve`);

      expect(res.status).toBe(403);
      expect((await statusOf('businesses', id)).status).toBe('pending');
    });
  });

  // REQ-3.8.1
  describe('GET /api/admin/submissions', () => {
    it('lists the pending businesses and events with who submitted them, oldest first', async () => {
      const first = await addBusiness('pending', member.id, 'First');
      await addBusiness('pending', null, 'Second');
      const event = await addEvent('pending', member.id);

      const res = await get('/api/admin/submissions', admin.token);

      expect(res.status).toBe(200);
      expect(res.body.businesses.map((b: { title: string }) => b.title)).toEqual(['First', 'Second']);
      expect(res.body.businesses[0]).toMatchObject({
        id: first, category: expect.any(String), submitterId: member.id, submitterName: 'Ada user', submitterEmail: 'member@test.com',
      });
      expect(res.body.businesses[1]).toMatchObject({ submitterId: null, submitterName: null });
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0]).toMatchObject({ id: event, title: 'Nowruz Gala', startsAt: expect.any(String) });
    });

    it('leaves out approved and rejected submissions', async () => {
      await addBusiness('approved');
      await addBusiness('rejected');
      await addEvent('approved');
      await addEvent('rejected');

      const res = await get('/api/admin/submissions', admin.token);

      expect(res.body).toEqual({ businesses: [], events: [] });
    });
  });

  // REQ-3.8.2 to 3.8.5
  describe.each([
    ['businesses', 'business', addBusiness],
    ['events', 'event', addEvent],
  ] as const)('%s', (table, key, add) => {
    it('approves a pending submission, which then appears in the public list', async () => {
      const id = await add();
      expect((await request(app).get(`/api/${table}/${id}`)).status).toBe(404);

      const res = await post(`/api/admin/${table}/${id}/approve`, admin.token);

      expect(res.status).toBe(200);
      expect(res.body[key]).toEqual({ id, status: 'approved' });
      expect(await statusOf(table, id)).toEqual({ status: 'approved', rejection_reason: null });
      expect((await request(app).get(`/api/${table}/${id}`)).status).toBe(200);
    });

    it('rejects a pending submission with a trimmed reason, and it stays out of the public list', async () => {
      const id = await add();

      const res = await post(`/api/admin/${table}/${id}/reject`, admin.token, { reason: '  Missing the address.  ' });

      expect(res.status).toBe(200);
      expect(res.body[key]).toEqual({ id, status: 'rejected' });
      expect(await statusOf(table, id)).toEqual({ status: 'rejected', rejection_reason: 'Missing the address.' });
      expect((await request(app).get(`/api/${table}/${id}`)).status).toBe(404);
    });

    it.each([
      [{}, 'Give the reason for the rejection.'],
      [{ reason: '   ' }, 'Give the reason for the rejection.'],
      [{ reason: 5 }, 'Give the reason for the rejection.'],
      [{ reason: 'x'.repeat(501) }, 'The reason can be at most 500 characters.'],
      [{ reason: 'a\0b' }, 'The reason contains characters that are not allowed.'],
    ])('refuses a rejection with %j', async (body, message) => {
      const id = await add();

      const res = await post(`/api/admin/${table}/${id}/reject`, admin.token, body);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ errors: { reason: message } });
      expect((await statusOf(table, id)).status).toBe('pending');
    });

    it('keeps markup and SQL in the reason as plain text', async () => {
      const id = await add();
      const reason = "<script>x</script>'; DROP TABLE users;--";

      await post(`/api/admin/${table}/${id}/reject`, admin.token, { reason });

      expect((await statusOf(table, id)).rejection_reason).toBe(reason);
    });

    it('answers 409 for a submission that was already decided, and keeps the first decision', async () => {
      const id = await add();
      await post(`/api/admin/${table}/${id}/approve`, admin.token);

      const again = await post(`/api/admin/${table}/${id}/reject`, admin.token, { reason: 'Changed my mind' });
      const twice = await post(`/api/admin/${table}/${id}/approve`, admin.token);

      expect(again.status).toBe(409);
      expect(twice.status).toBe(409);
      expect(await statusOf(table, id)).toEqual({ status: 'approved', rejection_reason: null });
    });

    it.each(['99999', 'abc', '0', '-1', '1;DROP TABLE users'])('answers 404 for the id %p', async (id) => {
      const approve = await post(`/api/admin/${table}/${encodeURIComponent(id)}/approve`, admin.token);
      const reject = await post(`/api/admin/${table}/${encodeURIComponent(id)}/reject`, admin.token, { reason: 'No' });

      expect(approve.status).toBe(404);
      expect(reject.status).toBe(404);
    });
  });
});
