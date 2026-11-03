import request from 'supertest';
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
