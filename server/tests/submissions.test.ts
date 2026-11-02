import { pool } from '../src/db';
import { countSubmissions } from '../src/submissions';

let userId: string;
let otherId: string;

async function addBusiness(owner: string | null, status = 'approved') {
  await pool.query(
    `INSERT INTO businesses (user_id, category_id, name, description, street, city, postal_code, phone, email, status)
     SELECT $1, c.id, 'Cafe', 'Coffee.', '1 Test St', 'Hamilton', 'L8P 1A1', '905-555-0100', 'a@example.com', $2
     FROM categories c WHERE c.type = 'business' AND c.name = 'Restaurant'`,
    [owner, status],
  );
}

async function addEvent(owner: string | null) {
  await pool.query(
    `INSERT INTO events (user_id, category_id, title, description, location, starts_at, organizer_name, organizer_contact)
     SELECT $1, c.id, 'Fest', 'Fun.', '1 Test St', '2026-12-01T18:00:00Z', 'Org', 'org@example.com'
     FROM categories c WHERE c.type = 'event' AND c.name = 'Festival'`,
    [owner],
  );
}

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, first_name, last_name) VALUES ('a@test.com','x','A','A'), ('b@test.com','x','B','B') RETURNING id",
  );
  [userId, otherId] = rows.map((r) => r.id as string).sort((a, b) => Number(a) - Number(b));
});

afterAll(async () => {
  await pool.end();
});

// REQ-3.2.3
describe('countSubmissions', () => {
  it('is 0 for someone who has submitted nothing', async () => {
    expect(await countSubmissions(userId)).toBe(0);
  });

  it('counts businesses and events together, whatever their review status', async () => {
    await addBusiness(userId, 'approved');
    await addBusiness(userId, 'pending');
    await addEvent(userId);

    expect(await countSubmissions(userId)).toBe(3);
  });

  it('counts only the member\'s own submissions', async () => {
    await addBusiness(userId);
    await addBusiness(otherId);
    await addEvent(otherId);

    expect(await countSubmissions(userId)).toBe(1);
    expect(await countSubmissions(otherId)).toBe(2);
  });

  it('does not count listings that lost their owner', async () => {
    await addBusiness(null);

    expect(await countSubmissions(userId)).toBe(0);
  });
});
