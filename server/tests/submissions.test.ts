import request from 'supertest';
import { browser, sessionToken } from './browser';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();
const DAY = 86400000;
const futureDate = (days = 30) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

async function signIn(email: string) {
  const registered = await browser(app).post('/api/users').send({ email, password: 'Test123@', firstName: 'Sam', lastName: 'Member' });
  const token = sessionToken(await browser(app).post('/api/auth/login').send({ email, password: 'Test123@' }))!;
  return { id: registered.body.id as string, token };
}

const categoryOf = async (type: string) => (await pool.query('SELECT id FROM categories WHERE type = $1 ORDER BY id LIMIT 1', [type])).rows[0].id as string;

async function addBusiness(userId: string, status = 'pending', name = 'Saffron House') {
  const { rows } = await pool.query(
    `INSERT INTO businesses (user_id, category_id, name, description, street, city, postal_code, phone, email, status, rejection_reason)
     VALUES ($1, $2, $3, 'Tea and sweets', '1 Main St', 'Toronto', 'M5V 2T6', '4165550100', 'a@b.ca', $4, $5) RETURNING id`,
    [userId, await categoryOf('business'), name, status, status === 'rejected' ? 'Add opening hours.' : null],
  );
  await pool.query("INSERT INTO business_hours (business_id, day_of_week, opens_at, closes_at) VALUES ($1, 2, '09:00', '17:00')", [rows[0].id]);
  return rows[0].id as string;
}

async function addEvent(userId: string, status = 'pending', title = 'Nowruz Gala') {
  const { rows } = await pool.query(
    `INSERT INTO events (user_id, category_id, title, description, location, starts_at, ends_at, organizer_name, organizer_contact, status, rejection_reason)
     VALUES ($1, $2, $3, 'Celebrate', 'Hamilton', now() + interval '10 days', now() + interval '10 days 2 hours', 'Org', 'org@x.ca', $4, $5) RETURNING id`,
    [userId, await categoryOf('event'), title, status, status === 'rejected' ? 'Add the venue address.' : null],
  );
  return rows[0].id as string;
}

const row = async (table: 'businesses' | 'events', id: string) => (await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id])).rows[0];

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await pool.query('DELETE FROM businesses');
  await pool.query('DELETE FROM events');
});

afterAll(async () => {
  await pool.end();
});

describe('Member submissions', () => {
  let me: { id: string; token: string };
  let other: { id: string; token: string };

  const get = (path: string, token: string | null = me.token) => browser(app, token ?? undefined).get(path);
  const put = (path: string, body: object, token: string | null = me.token) => browser(app, token ?? undefined).put(path).send(body);

  beforeEach(async () => {
    me = await signIn('me@test.com');
    other = await signIn('other@test.com');
  });

  // REQ-3.6.1 / 3.6.2
  describe('GET /api/submissions', () => {
    it('needs a login', async () => {
      expect((await get('/api/submissions', null)).status).toBe(401);
    });

    it('lists only my own businesses and events with their status, and the reason for a rejection', async () => {
      const pending = await addBusiness(me.id, 'pending', 'Pending Cafe');
      const rejected = await addBusiness(me.id, 'rejected', 'Rejected Cafe');
      await addBusiness(me.id, 'approved', 'Approved Cafe');
      await addBusiness(other.id, 'pending', 'Not Mine');
      const event = await addEvent(me.id, 'rejected');
      await addEvent(other.id, 'pending', 'Not Mine Either');

      const res = await get('/api/submissions');

      expect(res.status).toBe(200);
      expect(res.body.businesses.map((b: { title: string }) => b.title).sort()).toEqual(['Approved Cafe', 'Pending Cafe', 'Rejected Cafe']);
      const byId = (id: string) => res.body.businesses.find((b: { id: string }) => b.id === id);
      expect(byId(pending)).toMatchObject({ status: 'pending', rejectionReason: null, category: expect.any(String), submittedAt: expect.any(String) });
      expect(byId(rejected)).toMatchObject({ status: 'rejected', rejectionReason: 'Add opening hours.' });
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0]).toMatchObject({ id: event, status: 'rejected', rejectionReason: 'Add the venue address.' });
    });

    it('is empty for a member with nothing submitted', async () => {
      expect((await get('/api/submissions', other.token)).body).toEqual({ businesses: [], events: [] });
    });

    it('shows a submission the moment an administrator rejects it, with the reason', async () => {
      const id = await addBusiness(me.id);
      await pool.query("UPDATE businesses SET status = 'rejected', rejection_reason = 'Duplicate listing.' WHERE id = $1", [id]);

      expect((await get('/api/submissions')).body.businesses[0]).toMatchObject({ status: 'rejected', rejectionReason: 'Duplicate listing.' });
    });
  });

  // REQ-3.6.3 businesses
  describe('resubmitting a business', () => {
    const valid = async (changes: object = {}) => ({
      name: 'Saffron House Two', categoryId: await categoryOf('business'), description: 'Now with opening hours.', street: '2 Main St',
      city: 'Toronto', postalCode: 'M5V 2T6', phone: '(416) 555 0100', email: 'a@b.ca',
      hours: [{ day: 1, opens: '10:00', closes: '18:00' }, { day: 3, opens: '10:00', closes: '18:00' }],
      ...changes,
    });

    it('gives the owner the values of a rejected business to edit, with the reason', async () => {
      const id = await addBusiness(me.id, 'rejected');

      const res = await get(`/api/submissions/businesses/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.business).toMatchObject({
        name: 'Saffron House', postalCode: 'M5V 2T6', website: '', rejectionReason: 'Add opening hours.',
        hours: [{ day: 2, opens: '09:00', closes: '17:00' }],
      });
    });

    it.each(['pending', 'approved'])('answers 404 for editing a %s business', async (status) => {
      const id = await addBusiness(me.id, status);

      expect((await get(`/api/submissions/businesses/${id}`)).status).toBe(404);
      expect((await put(`/api/businesses/${id}`, await valid())).status).toBe(404);
    });

    it("answers 404 for someone else's rejected business, and changes nothing", async () => {
      const id = await addBusiness(other.id, 'rejected');

      expect((await get(`/api/submissions/businesses/${id}`)).status).toBe(404);
      expect((await put(`/api/businesses/${id}`, await valid())).status).toBe(404);
      expect((await row('businesses', id)).name).toBe('Saffron House');
    });

    it('updates the listing, sets it back to pending and clears the reason and the old hours', async () => {
      const id = await addBusiness(me.id, 'rejected');

      const res = await put(`/api/businesses/${id}`, await valid());

      expect(res.status).toBe(200);
      expect(res.body.business).toEqual({ id, name: 'Saffron House Two', status: 'pending' });
      expect(await row('businesses', id)).toMatchObject({ name: 'Saffron House Two', status: 'pending', rejection_reason: null, user_id: me.id });
      const hours = await pool.query('SELECT day_of_week FROM business_hours WHERE business_id = $1 ORDER BY 1', [id]);
      expect(hours.rows.map((h) => h.day_of_week)).toEqual([1, 3]);
      expect((await request(app).get(`/api/businesses/${id}`)).status).toBe(404);
    });

    it('can be decided again by an administrator after a resubmission', async () => {
      const id = await addBusiness(me.id, 'rejected');
      await put(`/api/businesses/${id}`, await valid());

      expect((await get('/api/submissions')).body.businesses[0].status).toBe('pending');
    });

    it('refuses bad values with a message per field, and keeps it rejected', async () => {
      const id = await addBusiness(me.id, 'rejected');

      const res = await put(`/api/businesses/${id}`, await valid({ name: '', email: 'nope' }));

      expect(res.status).toBe(400);
      expect(Object.keys(res.body.errors).sort()).toEqual(['email', 'name']);
      expect((await row('businesses', id)).status).toBe('rejected');
    });

    it('needs a login and the CSRF header', async () => {
      const id = await addBusiness(me.id, 'rejected');

      expect((await put(`/api/businesses/${id}`, await valid(), null)).status).toBe(401);
      expect((await request(app).put(`/api/businesses/${id}`).send(await valid())).status).toBe(403);
    });

    it.each(['abc', '0', '99999'])('answers 404 for the id %p', async (id) => {
      expect((await put(`/api/businesses/${id}`, await valid())).status).toBe(404);
      expect((await get(`/api/submissions/businesses/${id}`)).status).toBe(404);
    });
  });

  // REQ-3.6.3 events
  describe('resubmitting an event', () => {
    const valid = async (changes: object = {}) => ({
      title: 'Nowruz Gala Two', categoryId: await categoryOf('event'), description: 'Now at a named venue.', location: 'Hamilton Hall, 1 Main St',
      date: futureDate(), startTime: '18:00', endTime: '21:00', organizerName: 'Org', organizerContact: 'org@x.ca', ...changes,
    });

    it('gives the owner the values of a rejected event to edit, in Ontario time', async () => {
      const id = await addEvent(me.id, 'rejected');

      const res = await get(`/api/submissions/events/${id}`);

      expect(res.status).toBe(200);
      expect(res.body.event).toMatchObject({
        title: 'Nowruz Gala', location: 'Hamilton', organizerName: 'Org', rejectionReason: 'Add the venue address.',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), startTime: expect.stringMatching(/^\d{2}:\d{2}$/), endTime: expect.stringMatching(/^\d{2}:\d{2}$/),
      });
    });

    it.each(['pending', 'approved'])('answers 404 for editing a %s event', async (status) => {
      const id = await addEvent(me.id, status);

      expect((await get(`/api/submissions/events/${id}`)).status).toBe(404);
      expect((await put(`/api/events/${id}`, await valid())).status).toBe(404);
    });

    it("answers 404 for someone else's rejected event, and changes nothing", async () => {
      const id = await addEvent(other.id, 'rejected');

      expect((await put(`/api/events/${id}`, await valid())).status).toBe(404);
      expect((await row('events', id)).title).toBe('Nowruz Gala');
    });

    it('updates the event, sets it back to pending and clears the reason', async () => {
      const id = await addEvent(me.id, 'rejected');

      const res = await put(`/api/events/${id}`, await valid());

      expect(res.status).toBe(200);
      expect(res.body.event).toEqual({ id, title: 'Nowruz Gala Two', status: 'pending' });
      expect(await row('events', id)).toMatchObject({ title: 'Nowruz Gala Two', status: 'pending', rejection_reason: null, user_id: me.id });
      expect((await request(app).get(`/api/events/${id}`)).status).toBe(404);
    });

    it('refuses a date that has passed, and keeps it rejected', async () => {
      const id = await addEvent(me.id, 'rejected');

      const res = await put(`/api/events/${id}`, await valid({ date: '2020-01-01' }));

      expect(res.status).toBe(400);
      expect(res.body.errors.date).toBeDefined();
      expect((await row('events', id)).status).toBe('rejected');
    });

    it('refuses bad values with a message per field', async () => {
      const id = await addEvent(me.id, 'rejected');

      const res = await put(`/api/events/${id}`, await valid({ title: '' }));

      expect(res.status).toBe(400);
      expect(Object.keys(res.body.errors)).toEqual(['title']);
    });

    it('needs a login and the CSRF header', async () => {
      const id = await addEvent(me.id, 'rejected');

      expect((await put(`/api/events/${id}`, await valid(), null)).status).toBe(401);
      expect((await request(app).put(`/api/events/${id}`).send(await valid())).status).toBe(403);
    });
  });
});
