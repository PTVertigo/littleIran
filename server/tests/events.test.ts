import request from 'supertest';
import { browser, sessionToken } from './browser';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

async function addEvent(overrides: Record<string, unknown> = {}, category = 'Festival') {
  const values = {
    title: 'Test Festival',
    description: 'A celebration.',
    location: '1 Test Street, Hamilton',
    starts_at: inDays(10),
    organizer_name: 'Test Organizer',
    organizer_contact: 'organizer@example.com',
    status: 'approved',
    ...overrides,
  };
  const columns = Object.keys(values);
  const { rows } = await pool.query(
    `INSERT INTO events (category_id, ${columns.join(', ')})
     SELECT c.id, ${columns.map((_, i) => `$${i + 2}`).join(', ')} FROM categories c WHERE c.type = 'event' AND c.name = $1
     RETURNING id`,
    [category, ...Object.values(values)],
  );
  return rows[0].id as string;
}

const list = () => request(app).get('/api/events');
const titles = (res: request.Response) => res.body.events.map((e: { title: string }) => e.title);

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// REQ-3.4.1
describe('GET /api/events', () => {
  it('lists an approved event with its title, category, start, location and description', async () => {
    const startsAt = inDays(10);
    const id = await addEvent({ title: 'Norouz Festival', description: 'New Year.', location: 'Hamilton Hall', starts_at: startsAt });

    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([
      { id, title: 'Norouz Festival', category: 'Festival', startsAt: new Date(startsAt).toISOString(), location: 'Hamilton Hall', description: 'New Year.', past: false },
    ]);
  });

  it('answers with an empty list when there are no events', async () => {
    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ events: [] });
  });

  it('is open to a visitor who is not logged in', async () => {
    await addEvent();

    expect((await list()).status).toBe(200);
  });

  it('leaves out events that are pending or rejected', async () => {
    await addEvent({ title: 'Visible' });
    await addEvent({ title: 'Waiting', status: 'pending' });
    await addEvent({ title: 'Turned down', status: 'rejected', rejection_reason: 'Not a cultural event' });

    expect(titles(await list())).toEqual(['Visible']);
  });

  it('lists events from every category, each with its own category name', async () => {
    await addEvent({ title: 'A' }, 'Festival');
    await addEvent({ title: 'B' }, 'Workshop');
    await addEvent({ title: 'C' }, 'Cultural Events');

    const res = await list();

    expect(res.body.events.map((e: { category: string }) => e.category).sort()).toEqual(['Cultural Events', 'Festival', 'Workshop']);
  });

  it('puts events that have not finished first, soonest first, then finished ones, latest first', async () => {
    await addEvent({ title: 'Later', starts_at: inDays(30) });
    await addEvent({ title: 'Long ago', starts_at: inDays(-60) });
    await addEvent({ title: 'Soon', starts_at: inDays(2) });
    await addEvent({ title: 'Last week', starts_at: inDays(-7) });

    expect(titles(await list())).toEqual(['Soon', 'Later', 'Last week', 'Long ago']);
  });

  it('marks finished events as past, and counts one still running as not past', async () => {
    await addEvent({ title: 'Finished', starts_at: inDays(-3), ends_at: inDays(-2) });
    await addEvent({ title: 'Running', starts_at: inDays(-1), ends_at: inDays(1) });
    await addEvent({ title: 'No end time, started yesterday', starts_at: inDays(-1) });
    await addEvent({ title: 'Coming', starts_at: inDays(5) });

    const byTitle = Object.fromEntries((await list()).body.events.map((e: { title: string; past: boolean }) => [e.title, e.past]));

    expect(byTitle).toEqual({ Finished: true, Running: false, 'No end time, started yesterday': true, Coming: false });
  });

  it('keeps the order stable when two events start at the same moment', async () => {
    const startsAt = inDays(4);
    const ids = [await addEvent({ title: 'Same', starts_at: startsAt }), await addEvent({ title: 'Same', starts_at: startsAt })];

    expect((await list()).body.events.map((e: { id: string }) => e.id)).toEqual(ids);
  });

  it('does not show the organizer contact or who submitted the event', async () => {
    await addEvent();

    const [event] = (await list()).body.events;

    expect(Object.keys(event).sort()).toEqual(['category', 'description', 'id', 'location', 'past', 'startsAt', 'title']);
  });

  it('returns text with markup as plain text for the page to escape', async () => {
    await addEvent({ title: '<script>alert(1)</script> Night', description: '<img src=x onerror=alert(1)>' });

    const [event] = (await list()).body.events;

    expect(event.title).toBe('<script>alert(1)</script> Night');
    expect(event.description).toBe('<img src=x onerror=alert(1)>');
  });
});

// REQ-3.4.2
describe('GET /api/events/:id', () => {
  const detail = (id: string) => request(app).get(`/api/events/${encodeURIComponent(id)}`);

  it('returns the title, category, start and end, location, description and organizer', async () => {
    const startsAt = inDays(10);
    const endsAt = inDays(11);
    const id = await addEvent(
      {
        title: 'Yalda Night',
        description: 'Poetry and pomegranates.',
        location: 'Mississauga Banquet Hall',
        starts_at: startsAt,
        ends_at: endsAt,
        organizer_name: 'Peel Persian Community',
        organizer_contact: 'info@peel.example.com',
      },
      'Celebration',
    );

    const res = await detail(id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      event: {
        id,
        title: 'Yalda Night',
        category: 'Celebration',
        description: 'Poetry and pomegranates.',
        location: 'Mississauga Banquet Hall',
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        organizerName: 'Peel Persian Community',
        organizerContact: 'info@peel.example.com',
        past: false,
      },
    });
  });

  it('answers null for the end when no end time was given', async () => {
    const id = await addEvent();

    expect((await detail(id)).body.event.endsAt).toBeNull();
  });

  it('marks a finished event as past', async () => {
    const id = await addEvent({ starts_at: inDays(-3), ends_at: inDays(-2) });

    expect((await detail(id)).body.event.past).toBe(true);
  });

  it('is open to a visitor who is not logged in', async () => {
    const id = await addEvent();

    expect((await detail(id)).status).toBe(200);
  });

  it('does not show who submitted the event', async () => {
    const id = await addEvent();

    expect(Object.keys((await detail(id)).body.event)).not.toContain('userId');
    expect(JSON.stringify((await detail(id)).body)).not.toMatch(/user_id|userId/);
  });

  it.each(['pending', 'rejected'])('answers 404 for an event that is %s, like one that does not exist', async (status) => {
    const id = await addEvent({ status, rejection_reason: status === 'rejected' ? 'No' : null });

    const res = await detail(id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Event not found.' });
  });

  it('answers 404 for an id nobody has', async () => {
    expect((await detail('999999')).status).toBe(404);
  });

  it.each(['abc', '0', '-1', '1.5', '1 OR 1=1', "1'; DROP TABLE events;--", '9'.repeat(30), '%00'])(
    'answers 404 for the id %p and changes nothing',
    async (value) => {
      await addEvent();

      const res = await detail(value);

      expect(res.status).toBe(404);
      expect((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n).toBe(1);
    },
  );

  it('returns text with markup as plain text for the page to escape', async () => {
    const id = await addEvent({ title: '<b>x</b>', organizer_name: '<script>alert(1)</script>' });

    const { event } = (await detail(id)).body;

    expect(event.title).toBe('<b>x</b>');
    expect(event.organizerName).toBe('<script>alert(1)</script>');
  });
});

// REQ-3.7.2 / FE-004's search half
describe('GET /api/events?search=', () => {
  const search = (text: string) => request(app).get('/api/events').query({ search: text });

  beforeEach(async () => {
    await addEvent({ title: 'Norouz Festival', starts_at: inDays(5) }, 'Festival');
    await addEvent({ title: 'Persian Calligraphy Workshop', starts_at: inDays(6) }, 'Workshop');
    await addEvent({ title: 'Persian Film Night', starts_at: inDays(7), description: 'A workshop on film.' }, 'Cultural Events');
    await addEvent({ title: 'Yalda Night', starts_at: inDays(8) }, 'Celebration');
  });

  it('finds events whose name contains the word, ignoring case', async () => {
    expect(titles(await search('persian'))).toEqual(['Persian Calligraphy Workshop', 'Persian Film Night']);
    expect(titles(await search('PERSIAN'))).toEqual(['Persian Calligraphy Workshop', 'Persian Film Night']);
    expect(titles(await search('ouz'))).toEqual(['Norouz Festival']);
  });

  it('finds events whose category contains the word', async () => {
    expect(titles(await search('workshop'))).toEqual(['Persian Calligraphy Workshop']);
    expect(titles(await search('celebration'))).toEqual(['Yalda Night']);
    expect(titles(await search('cultural'))).toEqual(['Persian Film Night']);
  });

  it('finds a word in either the name or the category', async () => {
    await addEvent({ title: 'Festival of Lights', starts_at: inDays(9) }, 'Celebration');

    expect(titles(await search('festival'))).toEqual(['Norouz Festival', 'Festival of Lights']);
  });

  it('needs every word to match, each in the name or the category', async () => {
    expect(titles(await search('persian workshop'))).toEqual(['Persian Calligraphy Workshop']);
    expect(titles(await search('workshop persian'))).toEqual(['Persian Calligraphy Workshop']);
    expect(titles(await search('night cultural'))).toEqual(['Persian Film Night']);
    expect(titles(await search('persian yalda'))).toEqual([]);
  });

  it('does not look in the description', async () => {
    // "A workshop on film." is the description of Persian Film Night, whose name and category do not say so
    expect(titles(await search('film.'))).toEqual([]);
    expect(titles(await search('on film'))).toEqual([]);
  });

  it('answers with an empty list, not an error, when nothing matches', async () => {
    const res = await search('zzzzzz');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ events: [] });
  });

  it('lists everything for an empty or blank search', async () => {
    expect(titles(await search(''))).toHaveLength(4);
    expect(titles(await search('   '))).toHaveLength(4);
    expect(titles(await list())).toHaveLength(4);
  });

  it('ignores extra spaces around and between words', async () => {
    expect(titles(await search('   persian    workshop  '))).toEqual(['Persian Calligraphy Workshop']);
  });

  it('never returns a pending or rejected event, even when it matches', async () => {
    await addEvent({ title: 'Persian Waiting Room', status: 'pending' }, 'Workshop');
    await addEvent({ title: 'Persian Refused', status: 'rejected', rejection_reason: 'No venue.' }, 'Workshop');

    expect(titles(await search('persian'))).toEqual(['Persian Calligraphy Workshop', 'Persian Film Night']);
  });

  it('keeps the events that are still to come before the finished ones, whatever matched', async () => {
    await addEvent({ title: 'Persian Old Night', starts_at: inDays(-10) }, 'Workshop');
    await addEvent({ title: 'Persian Later', starts_at: inDays(40) }, 'Workshop');

    expect(titles(await search('persian'))).toEqual([
      'Persian Calligraphy Workshop', 'Persian Film Night', 'Persian Later', 'Persian Old Night',
    ]);
  });

  it('returns the same basic information as the events page', async () => {
    const [event] = (await search('norouz')).body.events;

    expect(Object.keys(event).sort()).toEqual(['category', 'description', 'id', 'location', 'past', 'startsAt', 'title']);
  });

  it('finds Persian-script names', async () => {
    await addEvent({ title: 'جشن نوروز' }, 'Festival');

    expect(titles(await search('نوروز'))).toEqual(['جشن نوروز']);
  });

  // REQ-4.1.1 the characters LIKE treats as wildcards mean themselves in a search
  it('treats % and _ as ordinary characters', async () => {
    await addEvent({ title: '50% Off Rug Sale' }, 'Workshop');
    await addEvent({ title: 'Under_score Night' }, 'Workshop');

    expect(titles(await search('%'))).toEqual(['50% Off Rug Sale']);
    expect(titles(await search('_'))).toEqual(['Under_score Night']);
    expect(titles(await search('U_der'))).toEqual([]);
  });

  it('treats a backslash as an ordinary character', async () => {
    expect((await search('\\')).body.events).toEqual([]);
    expect((await search('\\%')).status).toBe(200);
  });

  // API-004
  it.each([
    "'; DROP TABLE--",
    "'; DROP TABLE events;--",
    "' OR '1'='1",
    "persian' OR 1=1 --",
    '"; SELECT pg_sleep(5);--',
    "' UNION SELECT id, email, password_hash, email, email, email, email FROM users--",
    '$1',
    '${7*7}',
  ])('answers 200 and finds nothing for the injection attempt %p', async (attempt) => {
    const started = Date.now();

    const res = await search(attempt);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ events: [] });
    expect(Date.now() - started).toBeLessThan(4000);
    expect((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n).toBe(4);
  });

  it('uses only the first five words', async () => {
    expect((await search('persian film x x x x x x x x')).status).toBe(200);
  });

  it('refuses a search over 100 characters', async () => {
    const res = await search('a'.repeat(101));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Search for at most 100 characters.' });
  });

  it('refuses more than one search phrase', async () => {
    const res = await request(app).get('/api/events?search=a&search=b');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Search for a single phrase.' });
  });

  it('refuses a null character without a server error', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/api/events?search=pers%00ian');

    expect(res.status).toBe(400);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('is open to a visitor who is not logged in', async () => {
    expect((await search('persian')).status).toBe(200);
  });
});

// REQ-3.7.5 / FE-004
describe('GET /api/events?category=', () => {
  const filter = (category: string, search?: string) =>
    request(app).get('/api/events').query(search === undefined ? { category } : { category, search });

  beforeEach(async () => {
    await addEvent({ title: 'Norouz Festival', starts_at: inDays(5) }, 'Festival');
    await addEvent({ title: 'Persian Calligraphy Workshop', starts_at: inDays(6) }, 'Workshop');
    await addEvent({ title: 'Persian Film Night', starts_at: inDays(7) }, 'Cultural Events');
    await addEvent({ title: 'Evening of Classical Music', starts_at: inDays(8) }, 'Cultural Events');
    await addEvent({ title: 'Old Cultural Night', starts_at: inDays(-9) }, 'Cultural Events');
  });

  // FE-004: select 'Cultural Events' and only cultural events are displayed
  it('lists only the events in that category', async () => {
    const res = await filter('Cultural Events');

    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Persian Film Night', 'Evening of Classical Music', 'Old Cultural Night']);
    expect(res.body.events.every((e: { category: string }) => e.category === 'Cultural Events')).toBe(true);
  });

  it('matches the whole category name, ignoring case', async () => {
    expect(titles(await filter('workshop'))).toEqual(['Persian Calligraphy Workshop']);
    expect(titles(await filter('CULTURAL EVENTS'))).toHaveLength(3);
    expect(titles(await filter('  Festival  '))).toEqual(['Norouz Festival']);
    expect(titles(await filter('Cultural'))).toEqual([]);
  });

  it('keeps the events still to come before the finished ones', async () => {
    const res = await filter('Cultural Events');

    expect(res.body.events.map((e: { past: boolean }) => e.past)).toEqual([false, false, true]);
  });

  it('combines with the search: the event must be in the category and match every word', async () => {
    expect(titles(await filter('Cultural Events', 'persian'))).toEqual(['Persian Film Night']);
    expect(titles(await filter('Workshop', 'persian'))).toEqual(['Persian Calligraphy Workshop']);
    expect(titles(await filter('Festival', 'persian'))).toEqual([]);
    expect(titles(await filter('Cultural Events', 'music night'))).toEqual([]);
  });

  it('lists everything for an empty or blank category', async () => {
    expect(titles(await filter(''))).toHaveLength(5);
    expect(titles(await filter('   '))).toHaveLength(5);
  });

  it('answers with an empty list, not an error, for a category nobody has or that is for businesses', async () => {
    for (const category of ['Grocery', 'Restaurant', 'Retail']) {
      const res = await filter(category);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ events: [] });
    }
  });

  it('answers with an empty list for an event category that has no events yet', async () => {
    expect((await filter('Educational')).body).toEqual({ events: [] });
  });

  it('never returns a pending or rejected event, even in the category', async () => {
    await addEvent({ title: 'Waiting Night', status: 'pending' }, 'Cultural Events');
    await addEvent({ title: 'Refused Night', status: 'rejected', rejection_reason: 'No venue.' }, 'Cultural Events');

    expect(titles(await filter('Cultural Events'))).toHaveLength(3);
  });

  // REQ-4.1.1 and API-004
  it.each([
    "'; DROP TABLE events;--",
    "Workshop' OR '1'='1",
    "' UNION SELECT id, email, password_hash, email, email, email, email FROM users--",
    '"; SELECT pg_sleep(5);--',
    '$1',
    '%',
    '_',
  ])('treats the category %p as plain text, finds nothing, and changes nothing', async (attempt) => {
    const started = Date.now();

    const res = await filter(attempt);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ events: [] });
    expect(Date.now() - started).toBeLessThan(4000);
    expect((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n).toBe(5);
  });

  it('refuses a category name over 100 characters', async () => {
    const res = await filter('a'.repeat(101));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'That category name is too long.' });
  });

  it('refuses more than one category', async () => {
    const res = await request(app).get('/api/events?category=Workshop&category=Festival');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Choose a single category.' });
  });

  it('refuses a null character without a server error', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/api/events?category=Work%00shop');

    expect(res.status).toBe(400);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('is open to a visitor who is not logged in', async () => {
    expect((await filter('Workshop')).status).toBe(200);
  });
});

// REQ-3.4 create an event
describe('POST /api/events', () => {
  // A day about a month away, written as the organizer would pick it on a calendar
  const futureDate = (days = 30) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
  let token: string;
  let userId: string;
  let festivalId: string;

  const categoryId = async (type: string, name: string) =>
    (await pool.query('SELECT id FROM categories WHERE type = $1 AND name = $2', [type, name])).rows[0].id as string;
  // Pass null to send the request with no session at all
  const create = (body: object, session: string | null = token) => browser(app, session ?? undefined).post('/api/events').send(body);
  const valid = (changes: object = {}) => ({
    title: 'Yalda Night',
    categoryId: festivalId,
    description: 'Poetry and pomegranates.',
    location: 'Mississauga Banquet Hall',
    date: futureDate(),
    startTime: '19:30',
    endTime: '23:00',
    organizerName: 'Peel Persian Community',
    organizerContact: 'info@peel.example.com',
    ...changes,
  });

  beforeEach(async () => {
    const registered = await browser(app).post('/api/users')
      .send({ email: 'organizer@test.com', password: 'Test123@', firstName: 'Omid', lastName: 'Owner' });
    userId = registered.body.id;
    token = sessionToken(await browser(app).post('/api/auth/login').send({ email: 'organizer@test.com', password: 'Test123@' }))!;
    festivalId = await categoryId('event', 'Festival');
  });

  it('creates the event as pending and answers 201', async () => {
    const res = await create(valid());

    expect(res.status).toBe(201);
    expect(res.body.event).toEqual({ id: expect.any(String), title: 'Yalda Night', status: 'pending' });
  });

  it('stores the owner, the category, the organizer and the times as Ontario times', async () => {
    const date = futureDate();
    const id = (await create(valid({ date, startTime: '19:30', endTime: '23:00' }))).body.event.id;

    const { rows } = await pool.query(
      `SELECT user_id, category_id, status, title, description, location, organizer_name, organizer_contact,
              to_char(starts_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD HH24:MI') AS start_local,
              to_char(ends_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD HH24:MI') AS end_local
       FROM events WHERE id = $1`,
      [id],
    );

    expect(rows[0]).toEqual({
      user_id: userId,
      category_id: festivalId,
      status: 'pending',
      title: 'Yalda Night',
      description: 'Poetry and pomegranates.',
      location: 'Mississauga Banquet Hall',
      organizer_name: 'Peel Persian Community',
      organizer_contact: 'info@peel.example.com',
      start_local: `${date} 19:30`,
      end_local: `${date} 23:00`,
    });
  });

  it('keeps Ontario time through daylight saving: 7 pm is 00:00 UTC in winter and 23:00 UTC in summer', async () => {
    // Far enough ahead to be a real date, close enough to be inside the three-year limit
    const year = new Date().getUTCFullYear() + 1;
    const winter = (await create(valid({ date: `${year}-01-15`, startTime: '19:00', endTime: '' }))).body.event.id;
    const summer = (await create(valid({ date: `${year}-07-15`, startTime: '19:00', endTime: '' }))).body.event.id;

    const { rows } = await pool.query("SELECT id, to_char(starts_at AT TIME ZONE 'UTC', 'HH24:MI') AS utc FROM events WHERE id IN ($1, $2)", [winter, summer]);
    const utc = Object.fromEntries(rows.map((r) => [r.id, r.utc]));

    expect(utc[winter]).toBe('00:00');
    expect(utc[summer]).toBe('23:00');
  });

  it('stores no end time when none is given', async () => {
    const id = (await create(valid({ endTime: '' }))).body.event.id;

    expect((await pool.query('SELECT ends_at FROM events WHERE id = $1', [id])).rows[0].ends_at).toBeNull();
  });

  it('does not show the new event on the events page until it is approved', async () => {
    const id = (await create(valid())).body.event.id;

    expect(titles(await list())).toEqual([]);
    expect((await request(app).get(`/api/events/${id}`)).status).toBe(404);

    await pool.query("UPDATE events SET status = 'approved' WHERE id = $1", [id]);

    expect(titles(await list())).toEqual(['Yalda Night']);
  });

  it('trims the text before storing it', async () => {
    const id = (await create(valid({ title: '   Yalda Night   ', location: ' Hall ' }))).body.event.id;

    const { rows } = await pool.query('SELECT title, location FROM events WHERE id = $1', [id]);

    expect(rows[0]).toEqual({ title: 'Yalda Night', location: 'Hall' });
  });

  it('answers 401 without a session, and stores nothing', async () => {
    const res = await create(valid(), null);

    expect(res.status).toBe(401);
    expect((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n).toBe(0);
  });

  it('answers 403 without the CSRF header', async () => {
    const res = await request(app).post('/api/events').set('Cookie', `sid=${token}`).send(valid());

    expect(res.status).toBe(403);
    expect((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n).toBe(0);
  });

  it('answers 400 with a message per field, and stores nothing', async () => {
    const res = await create({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(
      ['categoryId', 'date', 'description', 'location', 'organizerContact', 'organizerName', 'startTime', 'title'],
    );
    expect((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n).toBe(0);
  });

  it('refuses a business category, and a category that does not exist', async () => {
    const business = await categoryId('business', 'Restaurant');

    for (const id of [business, '999999']) {
      const res = await create(valid({ categoryId: id }));
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual({ categoryId: 'Choose a category.' });
    }
  });

  it('refuses a date that has already passed', async () => {
    const res = await create(valid({ date: futureDate(-3), endTime: '' }));

    expect(res.status).toBe(400);
    expect(res.body.errors.date).toMatch(/have not passed yet/);
    expect((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n).toBe(0);
  });

  it('refuses a date more than three years away', async () => {
    const res = await create(valid({ date: futureDate(365 * 4) }));

    expect(res.status).toBe(400);
    expect(res.body.errors.date).toMatch(/next three years/);
  });

  it('refuses a date that is not on the calendar, with a message and not a server error', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await create(valid({ date: '2027-02-30' }));

    expect(res.status).toBe(400);
    expect(res.body.errors.date).toBe('Enter a real date.');
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('refuses an end that is not after the start', async () => {
    const res = await create(valid({ startTime: '20:00', endTime: '19:00' }));

    expect(res.status).toBe(400);
    expect(res.body.errors.endTime).toBe('The event must end after it starts.');
  });

  // REQ-4.1.1 and REQ-4.1.3 hostile text is data
  it.each(["'; DROP TABLE events;--", '<script>alert(1)</script>', "Robert'); DELETE FROM users;--", '${7*7}', '$1'])(
    'stores %p as plain text and changes nothing else',
    async (text) => {
      const res = await create(valid({ title: text, description: text, location: text, organizerName: text, organizerContact: text }));

      expect(res.status).toBe(201);
      const { rows } = await pool.query('SELECT title, description, location, organizer_name, organizer_contact FROM events');
      expect(rows).toEqual([{ title: text, description: text, location: text, organizer_name: text, organizer_contact: text }]);
      expect((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n).toBe(1);
    },
  );

  it('ignores a status, an owner or an id sent by the client', async () => {
    const res = await create({ ...valid(), status: 'approved', userId: '999', id: '5', user_id: '999' });

    expect(res.status).toBe(201);
    const { rows } = await pool.query('SELECT status, user_id FROM events WHERE id = $1', [res.body.event.id]);
    expect(rows[0]).toEqual({ status: 'pending', user_id: userId });
  });

  it('counts toward the member\'s submissions', async () => {
    await create(valid());
    await create(valid({ title: 'Another night' }));

    const profile = await browser(app, token).get(`/api/users/${userId}`);

    expect(profile.body.user.submissionCount).toBe(2);
  });
});
