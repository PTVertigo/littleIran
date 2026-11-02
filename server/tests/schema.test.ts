import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pool } from '../src/db';

const serverDir = path.join(__dirname, '..');

const categoryId = async (type: string, name: string) =>
  (await pool.query('SELECT id FROM categories WHERE type = $1 AND name = $2', [type, name])).rows[0].id as string;

async function addBusiness(overrides: Record<string, unknown> = {}) {
  const values = {
    category_id: await categoryId('business', 'Restaurant'),
    name: 'Test Restaurant',
    description: 'A place to eat.',
    street: '1 Test Street',
    city: 'Hamilton',
    postal_code: 'L8P 1A1',
    phone: '905-555-0100',
    email: 'info@example.com',
    ...overrides,
  };
  const columns = Object.keys(values);
  const { rows } = await pool.query(
    `INSERT INTO businesses (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(values),
  );
  return rows[0].id as string;
}

async function addEvent(overrides: Record<string, unknown> = {}) {
  const values = {
    category_id: await categoryId('event', 'Festival'),
    title: 'Test Festival',
    description: 'A celebration.',
    location: '1 Test Street, Hamilton',
    starts_at: '2026-12-01T18:00:00Z',
    organizer_name: 'Test Organizer',
    organizer_contact: 'organizer@example.com',
    ...overrides,
  };
  const columns = Object.keys(values);
  const { rows } = await pool.query(
    `INSERT INTO events (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(values),
  );
  return rows[0].id as string;
}

beforeEach(async () => {
  // Cascades to businesses, business hours and events, which all point at users
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// Milestone 4 §2.2 data definitions
describe('Categories', () => {
  it('holds the business categories from the data definition', async () => {
    const { rows } = await pool.query("SELECT name FROM categories WHERE type = 'business' ORDER BY id");

    expect(rows.map((r) => r.name)).toEqual([
      'Restaurant',
      'Retail',
      'Services',
      'Professional Services',
      'Entertainment',
      'Health & Wellness',
    ]);
  });

  it('holds the event categories, including Cultural Events for FE-004', async () => {
    const { rows } = await pool.query("SELECT name FROM categories WHERE type = 'event' ORDER BY id");

    expect(rows.map((r) => r.name)).toEqual([
      'Festival',
      'Workshop',
      'Celebration',
      'Educational',
      'Social Gathering',
      'Cultural Events',
    ]);
  });

  it('refuses a duplicate name within one type and a type that does not exist', async () => {
    await expect(pool.query("INSERT INTO categories (name, type) VALUES ('Restaurant', 'business')")).rejects.toThrow();
    await expect(pool.query("INSERT INTO categories (name, type) VALUES ('Anything', 'forum')")).rejects.toThrow();
  });
});

describe('Businesses', () => {
  it('starts a new listing as pending, with an optional website', async () => {
    const id = await addBusiness();

    const { rows } = await pool.query('SELECT status, website, user_id, rejection_reason FROM businesses WHERE id = $1', [id]);

    expect(rows[0]).toEqual({ status: 'pending', website: null, user_id: null, rejection_reason: null });
  });

  it('refuses a status outside pending, approved and rejected', async () => {
    await expect(addBusiness({ status: 'published' })).rejects.toThrow();
  });

  // REQ-3.6.2
  it('refuses a rejection without a reason, and accepts one with a reason', async () => {
    await expect(addBusiness({ status: 'rejected' })).rejects.toThrow();
    await expect(addBusiness({ status: 'rejected', rejection_reason: 'Address could not be verified.' })).resolves.toBeDefined();
  });

  it('refuses a missing required field', async () => {
    await expect(addBusiness({ phone: null })).rejects.toThrow();
    await expect(addBusiness({ postal_code: null })).rejects.toThrow();
  });

  it('only accepts a business category', async () => {
    await expect(addBusiness({ category_id: await categoryId('event', 'Festival') })).rejects.toThrow();
    await expect(addBusiness({ category_id: '999999' })).rejects.toThrow();
  });

  // REQ-3.2.4 submissions outlive the account that made them
  it('keeps the listing, without an owner, when its owner\'s account is deleted', async () => {
    const { rows: users } = await pool.query(
      "INSERT INTO users (email, password_hash, first_name, last_name) VALUES ('owner@test.com', 'x', 'Own', 'Er') RETURNING id",
    );
    const id = await addBusiness({ user_id: users[0].id });

    await pool.query('DELETE FROM users WHERE id = $1', [users[0].id]);

    const { rows } = await pool.query('SELECT user_id FROM businesses WHERE id = $1', [id]);
    expect(rows).toEqual([{ user_id: null }]);
  });
});

describe('Business hours', () => {
  const addHours = (businessId: string, day: number, opens: string, closes: string) =>
    pool.query('INSERT INTO business_hours (business_id, day_of_week, opens_at, closes_at) VALUES ($1, $2, $3, $4)', [
      businessId,
      day,
      opens,
      closes,
    ]);

  it('stores an open and a close time for each day', async () => {
    const id = await addBusiness();

    await addHours(id, 1, '09:00', '17:00');
    await addHours(id, 7, '12:00', '16:30');

    const { rows } = await pool.query('SELECT day_of_week FROM business_hours WHERE business_id = $1 ORDER BY 1', [id]);
    expect(rows.map((r) => r.day_of_week)).toEqual([1, 7]);
  });

  it('refuses a day outside 1 to 7, a second entry for the same day, and closing before opening', async () => {
    const id = await addBusiness();
    await addHours(id, 2, '09:00', '17:00');

    await expect(addHours(id, 0, '09:00', '17:00')).rejects.toThrow();
    await expect(addHours(id, 8, '09:00', '17:00')).rejects.toThrow();
    await expect(addHours(id, 2, '10:00', '18:00')).rejects.toThrow();
    await expect(addHours(id, 3, '17:00', '09:00')).rejects.toThrow();
  });

  it('goes away with its business', async () => {
    const id = await addBusiness();
    await addHours(id, 1, '09:00', '17:00');

    await pool.query('DELETE FROM businesses WHERE id = $1', [id]);

    expect((await pool.query('SELECT count(*)::int AS n FROM business_hours')).rows[0].n).toBe(0);
  });
});

describe('Events', () => {
  it('starts a new event as pending, and the end time is optional', async () => {
    const id = await addEvent();

    const { rows } = await pool.query('SELECT status, ends_at FROM events WHERE id = $1', [id]);

    expect(rows[0]).toEqual({ status: 'pending', ends_at: null });
  });

  it('refuses an event that ends before it starts', async () => {
    await expect(addEvent({ ends_at: '2026-12-01T17:00:00Z' })).rejects.toThrow();
    await expect(addEvent({ ends_at: '2026-12-01T21:00:00Z' })).resolves.toBeDefined();
  });

  it('only accepts an event category', async () => {
    await expect(addEvent({ category_id: await categoryId('business', 'Restaurant') })).rejects.toThrow();
  });

  it('refuses a rejection without a reason, a missing organizer, and an unknown status', async () => {
    await expect(addEvent({ status: 'rejected' })).rejects.toThrow();
    await expect(addEvent({ organizer_name: null })).rejects.toThrow();
    await expect(addEvent({ status: 'live' })).rejects.toThrow();
  });
});

// The sample listings the browse, search and pagination features are built and tested against
describe('Sample business listings (npm run seed:listings)', () => {
  const runSeed = () =>
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/seed-listings.ts'], {
      cwd: serverDir,
      env: { ...process.env },
      encoding: 'utf8',
    });

  it('adds approved businesses across every category, with hours, and enough for a second page', async () => {
    runSeed();

    const { rows: businesses } = await pool.query(
      `SELECT b.status, b.user_id, b.email, c.name AS category
       FROM businesses b JOIN categories c ON c.id = b.category_id`,
    );
    expect(businesses.length).toBeGreaterThan(10);
    expect(businesses.every((b) => b.status === 'approved' && b.user_id === null)).toBe(true);
    expect(new Set(businesses.map((b) => b.category)).size).toBe(6);
    expect(businesses.every((b) => b.email.endsWith('.example.com'))).toBe(true);

    const { rows: withoutHours } = await pool.query(
      'SELECT count(*)::int AS n FROM businesses b WHERE NOT EXISTS (SELECT 1 FROM business_hours h WHERE h.business_id = b.id)',
    );
    expect(withoutHours[0].n).toBe(0);
  });

  it('includes several businesses with "Restaurant" in the name, for the FE-003 search', async () => {
    runSeed();

    const { rows } = await pool.query("SELECT count(*)::int AS n FROM businesses WHERE name ILIKE '%Restaurant%'");
    expect(rows[0].n).toBeGreaterThanOrEqual(3);
  });

  it('can be run twice without adding anything the second time', async () => {
    runSeed();
    const before = (await pool.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n;

    const output = runSeed();

    expect((await pool.query('SELECT count(*)::int AS n FROM businesses')).rows[0].n).toBe(before);
    expect(output).toContain('added 0 sample businesses');
  });
});
