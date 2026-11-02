import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();

async function addBusiness(overrides: Record<string, unknown> = {}, category = 'Restaurant') {
  const values = {
    name: 'Test Restaurant',
    description: 'A place to eat.',
    street: '1 Test Street',
    city: 'Hamilton',
    postal_code: 'L8P 1A1',
    phone: '905-555-0100',
    email: 'info@example.com',
    status: 'approved',
    ...overrides,
  };
  const columns = Object.keys(values);
  const { rows } = await pool.query(
    `INSERT INTO businesses (category_id, ${columns.join(', ')})
     SELECT c.id, ${columns.map((_, i) => `$${i + 2}`).join(', ')} FROM categories c WHERE c.type = 'business' AND c.name = $1
     RETURNING id`,
    [category, ...Object.values(values)],
  );
  return rows[0].id as string;
}

const list = () => request(app).get('/api/businesses');
const detail = (id: string) => request(app).get(`/api/businesses/${encodeURIComponent(id)}`);
const addHours = (businessId: string, day: number, opens: string, closes: string) =>
  pool.query('INSERT INTO business_hours (business_id, day_of_week, opens_at, closes_at) VALUES ($1, $2, $3, $4)', [
    businessId,
    day,
    opens,
    closes,
  ]);

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// REQ-3.3.1
describe('GET /api/businesses', () => {
  it('lists an approved business with its name, category, city and description', async () => {
    const id = await addBusiness({ name: 'Norouz Restaurant', city: 'Toronto', description: 'Kebabs and stews.' });

    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      businesses: [{ id, name: 'Norouz Restaurant', category: 'Restaurant', city: 'Toronto', description: 'Kebabs and stews.' }],
    });
  });

  it('answers with an empty list when there are no businesses', async () => {
    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ businesses: [] });
  });

  it('leaves out businesses that are pending or rejected', async () => {
    await addBusiness({ name: 'Visible Restaurant' });
    await addBusiness({ name: 'Waiting Restaurant', status: 'pending' });
    await addBusiness({ name: 'Refused Restaurant', status: 'rejected', rejection_reason: 'Could not verify the address.' });

    const res = await list();

    expect(res.body.businesses.map((b: { name: string }) => b.name)).toEqual(['Visible Restaurant']);
  });

  it('lists businesses from every category, each with its own category name', async () => {
    await addBusiness({ name: 'Rug House' }, 'Retail');
    await addBusiness({ name: 'Hair Studio' }, 'Services');
    await addBusiness({ name: 'Tax Help' }, 'Professional Services');

    const res = await list();

    expect(res.body.businesses.map((b: { category: string }) => b.category).sort()).toEqual([
      'Professional Services',
      'Retail',
      'Services',
    ]);
  });

  it('sorts by name, ignoring upper and lower case', async () => {
    await addBusiness({ name: 'banana Cafe' });
    await addBusiness({ name: 'Apple Cafe' });
    await addBusiness({ name: 'cherry Cafe' });

    const res = await list();

    expect(res.body.businesses.map((b: { name: string }) => b.name)).toEqual(['Apple Cafe', 'banana Cafe', 'cherry Cafe']);
  });

  it('works without logging in, because approved listings are public', async () => {
    await addBusiness();

    const res = await request(app).get('/api/businesses');

    expect(res.status).toBe(200);
    expect(res.body.businesses).toHaveLength(1);
  });

  it('shares only basic information, never the contact details, owner or review status', async () => {
    await addBusiness();

    const [business] = (await list()).body.businesses;

    expect(Object.keys(business).sort()).toEqual(['category', 'city', 'description', 'id', 'name']);
    expect(JSON.stringify(business)).not.toMatch(/info@example|905-555|Test Street|L8P|approved|user_id/);
  });

  // REQ-4.1.3 stored as typed; the web app escapes it when showing it
  it('returns a name containing markup as plain text data', async () => {
    await addBusiness({ name: '<script>alert(1)</script> Cafe' });

    const res = await list();

    expect(res.body.businesses[0].name).toBe('<script>alert(1)</script> Cafe');
    expect(res.type).toBe('application/json');
  });

  it('is not cached by browsers or proxies', async () => {
    expect((await list()).headers['cache-control']).toBe('no-store');
  });
});

// REQ-3.3.2
describe('GET /api/businesses/:id', () => {
  it('returns the name, address, phone, email, website, hours, description and category', async () => {
    const id = await addBusiness({
      name: 'Pars Rug Gallery',
      description: 'Hand-knotted rugs.',
      street: '9 Example Road',
      city: 'Oakville',
      postal_code: 'L6H 5H8',
      phone: '905-555-0108',
      email: 'info@pars.example.com',
      website: 'https://example.com/pars',
    }, 'Retail');
    await addHours(id, 1, '10:00', '19:00');
    await addHours(id, 6, '09:30', '17:45');

    const res = await detail(id);

    expect(res.status).toBe(200);
    expect(res.body.business).toEqual({
      id,
      name: 'Pars Rug Gallery',
      category: 'Retail',
      description: 'Hand-knotted rugs.',
      street: '9 Example Road',
      city: 'Oakville',
      postalCode: 'L6H 5H8',
      phone: '905-555-0108',
      email: 'info@pars.example.com',
      website: 'https://example.com/pars',
      hours: [
        { day: 1, opens: '10:00', closes: '19:00' },
        { day: 6, opens: '09:30', closes: '17:45' },
      ],
    });
  });

  it('gives hours as plain HH:MM times, in day order, with no row for a day it is closed', async () => {
    const id = await addBusiness();
    await addHours(id, 7, '12:00', '16:00');
    await addHours(id, 2, '08:00', '20:00');

    const { hours } = (await detail(id)).body.business;

    expect(hours.map((h: { day: number }) => h.day)).toEqual([2, 7]);
    expect(hours[0]).toEqual({ day: 2, opens: '08:00', closes: '20:00' });
  });

  it('has an empty hours list and a null website when none were given', async () => {
    const id = await addBusiness();

    const { business } = (await detail(id)).body;

    expect(business.hours).toEqual([]);
    expect(business.website).toBeNull();
  });

  it('only returns the hours of the business that was asked for', async () => {
    const first = await addBusiness({ name: 'First Cafe' });
    const second = await addBusiness({ name: 'Second Cafe' });
    await addHours(first, 1, '09:00', '10:00');
    await addHours(second, 2, '11:00', '12:00');

    expect((await detail(first)).body.business.hours).toEqual([{ day: 1, opens: '09:00', closes: '10:00' }]);
  });

  it('works without logging in', async () => {
    const id = await addBusiness();

    expect((await request(app).get(`/api/businesses/${id}`)).status).toBe(200);
  });

  it('shares nothing about who submitted it or its review status', async () => {
    const id = await addBusiness();

    const { business } = (await detail(id)).body;

    expect(Object.keys(business).sort()).toEqual([
      'category', 'city', 'description', 'email', 'hours', 'id', 'name', 'phone', 'postalCode', 'street', 'website',
    ]);
    expect(JSON.stringify(business)).not.toMatch(/user_id|status|rejection|created/i);
  });

  it('answers "not found" for a pending or rejected listing, just as for one that does not exist', async () => {
    const pending = await addBusiness({ name: 'Waiting Cafe', status: 'pending' });
    const rejected = await addBusiness({ name: 'Refused Cafe', status: 'rejected', rejection_reason: 'No such address.' });

    for (const id of [pending, rejected, '99999']) {
      const res = await detail(id);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Business not found.' });
    }
  });

  // REQ-4.1.1 and REQ-4.2.4 an id that is not a number is a missing business, never a database error
  it.each(['abc', '0', '-1', '1.5', '1 OR 1=1', "1'; DROP TABLE businesses;--", '9'.repeat(30), '%00'])(
    'says not found for the id %p without touching the database',
    async (id) => {
      await addBusiness();
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await detail(id);

      expect(res.status).toBe(404);
      expect(error).not.toHaveBeenCalled();
      expect((await pool.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n).toBe(1);
      error.mockRestore();
    },
  );

  it('is not cached by browsers or proxies', async () => {
    const id = await addBusiness();

    expect((await detail(id)).headers['cache-control']).toBe('no-store');
  });
});
