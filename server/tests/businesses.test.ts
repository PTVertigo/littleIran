import request from 'supertest';
import { browser, sessionToken } from './browser';
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

// REQ-3.7.1
describe('GET /api/businesses?search=', () => {
  const search = (text: string) => request(app).get('/api/businesses').query({ search: text });
  const names = (res: request.Response) => res.body.businesses.map((b: { name: string }) => b.name);

  beforeEach(async () => {
    await addBusiness({ name: 'Norouz Restaurant' }, 'Restaurant');
    await addBusiness({ name: 'Persian Cafe' }, 'Restaurant');
    await addBusiness({ name: 'Persian Rug Gallery' }, 'Retail');
    await addBusiness({ name: 'Hafez Clinic', description: 'Restaurant-quality nutrition advice.' }, 'Health & Wellness');
  });

  it('finds businesses whose name contains the word, ignoring case', async () => {
    expect(names(await search('persian'))).toEqual(['Persian Cafe', 'Persian Rug Gallery']);
    expect(names(await search('PERSIAN'))).toEqual(['Persian Cafe', 'Persian Rug Gallery']);
    expect(names(await search('ouz'))).toEqual(['Norouz Restaurant']);
  });

  it('finds businesses whose category contains the word', async () => {
    expect(names(await search('retail'))).toEqual(['Persian Rug Gallery']);
    expect(names(await search('health'))).toEqual(['Hafez Clinic']);
    expect(names(await search('wellness'))).toEqual(['Hafez Clinic']);
  });

  // FE-003: "Restaurant" shows the businesses with Restaurant in the name, and the Restaurant category
  it('finds a word in either the name or the category', async () => {
    expect(names(await search('Restaurant'))).toEqual(['Norouz Restaurant', 'Persian Cafe']);
  });

  it('needs every word to match, each in the name or the category', async () => {
    expect(names(await search('persian restaurant'))).toEqual(['Persian Cafe']);
    expect(names(await search('restaurant persian'))).toEqual(['Persian Cafe']);
    expect(names(await search('persian retail'))).toEqual(['Persian Rug Gallery']);
    expect(names(await search('persian clinic'))).toEqual([]);
  });

  it('does not look in the description', async () => {
    expect(names(await search('nutrition'))).toEqual([]);
  });

  it('answers with an empty list, not an error, when nothing matches', async () => {
    const res = await search('zzzzzz');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ businesses: [] });
  });

  it('lists everything for an empty or blank search', async () => {
    expect(await search('')).toMatchObject({ status: 200 });
    expect(names(await search(''))).toHaveLength(4);
    expect(names(await search('   '))).toHaveLength(4);
    expect(names(await request(app).get('/api/businesses'))).toHaveLength(4);
  });

  it('ignores extra spaces around and between words', async () => {
    expect(names(await search('   persian    restaurant  '))).toEqual(['Persian Cafe']);
  });

  it('never returns a pending or rejected listing, even when it matches', async () => {
    await addBusiness({ name: 'Persian Waiting Room', status: 'pending' }, 'Restaurant');
    await addBusiness({ name: 'Persian Refused', status: 'rejected', rejection_reason: 'No address.' }, 'Restaurant');

    expect(names(await search('persian'))).toEqual(['Persian Cafe', 'Persian Rug Gallery']);
  });

  it('keeps the results in name order', async () => {
    expect(names(await search('e'))).toEqual(['Hafez Clinic', 'Norouz Restaurant', 'Persian Cafe', 'Persian Rug Gallery']);
  });

  it('returns the same basic information as the directory', async () => {
    const [business] = (await search('norouz')).body.businesses;

    expect(Object.keys(business).sort()).toEqual(['category', 'city', 'description', 'id', 'name']);
  });

  it('finds Persian-script names', async () => {
    await addBusiness({ name: 'رستوران نوروز' }, 'Restaurant');

    expect(names(await search('نوروز'))).toEqual(['رستوران نوروز']);
  });

  // REQ-4.1.1 the characters LIKE treats as wildcards mean themselves in a search
  it('treats % and _ as ordinary characters', async () => {
    await addBusiness({ name: '100% Persian Rugs' }, 'Retail');
    await addBusiness({ name: 'Under_score Cafe' }, 'Restaurant');

    expect(names(await search('%'))).toEqual(['100% Persian Rugs']);
    expect(names(await search('_'))).toEqual(['Under_score Cafe']);
    expect(names(await search('100%'))).toEqual(['100% Persian Rugs']);
    expect(names(await search('P_rsian'))).toEqual([]);
  });

  it('treats a backslash as an ordinary character', async () => {
    expect((await search('\\')).body.businesses).toEqual([]);
    expect((await search('\\%')).status).toBe(200);
  });

  // API-004
  it.each([
    "'; DROP TABLE--",
    "'; DROP TABLE businesses;--",
    "' OR '1'='1",
    "persian' OR 1=1 --",
    '"; SELECT pg_sleep(5);--',
    "' UNION SELECT id, email, password_hash, email, email FROM users--",
    '$1',
    '${7*7}',
  ])('answers 200 and finds nothing for the injection attempt %p', async (attempt) => {
    const started = Date.now();

    const res = await search(attempt);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ businesses: [] });
    expect(Date.now() - started).toBeLessThan(4000);
    expect((await pool.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n).toBe(4);
  });

  it('does not let an injection attempt match everything', async () => {
    expect(names(await search("' OR '1'='1"))).toEqual([]);
    expect(names(await search("persian' OR 1=1 --"))).toEqual([]);
  });

  it('uses only the first five words', async () => {
    const res = await search('persian cafe x x x x x x x x');

    expect(res.status).toBe(200);
  });

  it('refuses a search over 100 characters', async () => {
    const res = await search('a'.repeat(101));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Search for at most 100 characters.' });
  });

  it('refuses more than one search phrase', async () => {
    const res = await request(app).get('/api/businesses?search=a&search=b');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Search for a single phrase.' });
  });

  it('refuses a null character without a server error', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/api/businesses?search=pers%00ian');

    expect(res.status).toBe(400);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('is open to a visitor who is not logged in', async () => {
    expect((await search('persian')).status).toBe(200);
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

// REQ-3.3 / API-003
describe('POST /api/businesses', () => {
  const listing = () => ({
    name: 'Darband Restaurant',
    categoryId: '',
    description: 'Mountain-style Persian dining.',
    street: '45 Example Road',
    city: 'Mississauga',
    postalCode: 'l5b 1b2',
    phone: '(905) 555 0102',
    email: 'Info@Darband.example.com',
    website: 'https://example.com/darband',
    hours: [
      { day: 1, opens: '12:00', closes: '23:00' },
      { day: 6, opens: '12:00', closes: '23:30' },
    ],
  });
  let token: string;
  let userId: string;
  let restaurantId: string;

  const categoryId = async (type: string, name: string) =>
    (await pool.query('SELECT id FROM categories WHERE type = $1 AND name = $2', [type, name])).rows[0].id as string;
  // Pass null to send the request with no session at all
  const create = (body: object, session: string | null = token) => browser(app, session ?? undefined).post('/api/businesses').send(body);
  const valid = () => ({ ...listing(), categoryId: restaurantId });

  beforeEach(async () => {
    const registered = await browser(app).post('/api/users')
      .send({ email: 'owner@test.com', password: 'Test123@', firstName: 'Omid', lastName: 'Owner' });
    userId = registered.body.id;
    token = sessionToken(await browser(app).post('/api/auth/login').send({ email: 'owner@test.com', password: 'Test123@' }))!;
    restaurantId = await categoryId('business', 'Restaurant');
  });

  // API-003
  it('creates the listing as pending and answers 201', async () => {
    const res = await create(valid());

    expect(res.status).toBe(201);
    expect(res.body.business).toEqual({ id: expect.any(String), name: 'Darband Restaurant', status: 'pending' });
  });

  it('stores the cleaned-up values, the owner, the category and the hours', async () => {
    const id = (await create(valid())).body.business.id;

    const { rows } = await pool.query('SELECT * FROM businesses WHERE id = $1', [id]);
    expect(rows[0]).toMatchObject({
      user_id: userId,
      category_id: restaurantId,
      name: 'Darband Restaurant',
      street: '45 Example Road',
      city: 'Mississauga',
      postal_code: 'L5B 1B2',
      phone: '905-555-0102',
      email: 'info@darband.example.com',
      website: 'https://example.com/darband',
      status: 'pending',
      rejection_reason: null,
    });
    const hours = await pool.query(
      "SELECT day_of_week, to_char(opens_at, 'HH24:MI') AS opens, to_char(closes_at, 'HH24:MI') AS closes FROM business_hours WHERE business_id = $1 ORDER BY 1",
      [id],
    );
    expect(hours.rows).toEqual([
      { day_of_week: 1, opens: '12:00', closes: '23:00' },
      { day_of_week: 6, opens: '12:00', closes: '23:30' },
    ]);
  });

  it('does not show the listing in the directory or on its own page until it is approved', async () => {
    const id = (await create(valid())).body.business.id;

    expect((await list()).body.businesses).toEqual([]);
    expect((await detail(id)).status).toBe(404);

    await pool.query("UPDATE businesses SET status = 'approved' WHERE id = $1", [id]);
    expect((await list()).body.businesses).toHaveLength(1);
    expect((await detail(id)).body.business.hours).toHaveLength(2);
  });

  it('works without a website', async () => {
    const res = await create({ ...valid(), website: '' });

    expect(res.status).toBe(201);
    expect((await pool.query('SELECT website FROM businesses')).rows[0].website).toBeNull();
  });

  it('ignores a status, owner or reason sent in the request', async () => {
    const res = await create({ ...valid(), status: 'approved', user_id: '999', userId: '999', rejection_reason: 'x' });

    const { rows } = await pool.query('SELECT user_id, status, rejection_reason FROM businesses WHERE id = $1', [res.body.business.id]);
    expect(rows[0]).toEqual({ user_id: userId, status: 'pending', rejection_reason: null });
  });

  it('counts towards the member\'s submissions on their public profile', async () => {
    await create(valid());
    await create({ ...valid(), name: 'Second Restaurant' });

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM businesses WHERE user_id = $1', [userId]);
    expect(rows[0].n).toBe(2);
  });

  it('stores markup and SQL in a name as plain text', async () => {
    const name = "Bobby'); DROP TABLE businesses;--<script>alert(1)</script>";

    const res = await create({ ...valid(), name });

    expect(res.status).toBe(201);
    expect((await pool.query('SELECT name FROM businesses')).rows[0].name).toBe(name);
  });

  // UT-005 at the API: bad input gets one message per field and nothing is saved
  it('answers 400 with a message per field, and saves nothing, when fields are missing', async () => {
    const res = await create({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual([
      'categoryId', 'city', 'description', 'email', 'hours', 'name', 'phone', 'postalCode', 'street',
    ]);
    expect((await pool.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n).toBe(0);
  });

  it.each([
    ['a website that is not a web address', { website: 'javascript:alert(1)' }, 'website'],
    ['a phone number that is too short', { phone: '555-0102' }, 'phone'],
    ['a postal code that is not Canadian', { postalCode: '90210' }, 'postalCode'],
    ['an invalid email address', { email: 'info@darband' }, 'email'],
    ['a business that closes before it opens', { hours: [{ day: 1, opens: '20:00', closes: '08:00' }] }, 'hours'],
    ['no opening hours', { hours: [] }, 'hours'],
    ['a name over 100 characters', { name: 'a'.repeat(101) }, 'name'],
  ])('refuses %s', async (_label, change, field) => {
    const res = await create({ ...valid(), ...change });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual([field]);
    expect((await pool.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n).toBe(0);
  });

  it('refuses a category that does not exist, or that belongs to events', async () => {
    for (const id of ['99999', await categoryId('event', 'Festival')]) {
      const res = await create({ ...valid(), categoryId: id });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual({ categoryId: 'Choose a category.' });
    }
    expect((await pool.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n).toBe(0);
  });

  it('leaves no half-saved listing when saving the hours fails part way', async () => {
    // The listing and its first day are written before Saturday is rejected, so this proves the whole save is undone
    await pool.query(`
      CREATE FUNCTION fail_saturday() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.day_of_week = 6 THEN RAISE EXCEPTION 'simulated failure'; END IF;
        RETURN NEW;
      END $$`);
    await pool.query('CREATE TRIGGER fail_saturday BEFORE INSERT ON business_hours FOR EACH ROW EXECUTE FUNCTION fail_saturday()');
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await create(valid());

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Something went wrong. Please try again.' });
      expect((await pool.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n).toBe(0);
      expect((await pool.query('SELECT count(*)::int AS n FROM business_hours')).rows[0].n).toBe(0);
    } finally {
      error.mockRestore();
      await pool.query('DROP TRIGGER fail_saturday ON business_hours');
      await pool.query('DROP FUNCTION fail_saturday()');
    }
  });

  it('asks a visitor with no session to log in, and saves nothing', async () => {
    const res = await create(valid(), null);

    expect(res.status).toBe(401);
    expect((await pool.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n).toBe(0);
  });

  // REQ-4.1.4 state-changing requests need the CSRF token
  it('refuses a request without the CSRF token', async () => {
    const res = await request(app).post('/api/businesses').set('Cookie', `sid=${token}`).send(valid());

    expect(res.status).toBe(403);
    expect((await pool.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n).toBe(0);
  });
});
