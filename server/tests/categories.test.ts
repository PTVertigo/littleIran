import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe('GET /api/categories', () => {
  it('lists the business categories in order, with their ids', async () => {
    const res = await request(app).get('/api/categories?type=business');

    expect(res.status).toBe(200);
    expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual([
      'Restaurant',
      'Retail',
      'Services',
      'Professional Services',
      'Entertainment',
      'Health & Wellness',
    ]);
    expect(res.body.categories[0]).toEqual({ id: expect.any(String), name: 'Restaurant' });
  });

  it('lists the event categories, including Cultural Events', async () => {
    const res = await request(app).get('/api/categories?type=event');

    expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual([
      'Festival',
      'Workshop',
      'Celebration',
      'Educational',
      'Social Gathering',
      'Cultural Events',
    ]);
  });

  it('never mixes the two kinds', async () => {
    const business = (await request(app).get('/api/categories?type=business')).body.categories;
    const event = (await request(app).get('/api/categories?type=event')).body.categories;

    const ids = new Set([...business, ...event].map((c: { id: string }) => c.id));
    expect(ids.size).toBe(business.length + event.length);
  });

  it.each(['', 'forum', 'business,event', "business'; DROP TABLE categories;--"])('asks for a valid type instead of %p', async (type) => {
    const res = await request(app).get(`/api/categories?type=${encodeURIComponent(type)}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Choose a category type: business or event.' });
  });

  it('asks for a type when none is given, or when it is given twice', async () => {
    expect((await request(app).get('/api/categories')).status).toBe(400);
    expect((await request(app).get('/api/categories?type=business&type=event')).status).toBe(400);
  });

  it('is open to everyone', async () => {
    expect((await request(app).get('/api/categories?type=business')).status).toBe(200);
  });
});
