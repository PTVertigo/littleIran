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
