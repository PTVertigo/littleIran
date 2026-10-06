import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();
const credentials = { email: 'test@test.com', password: 'Test123@' };

const loginAs = async (body = credentials) =>
  (await request(app).post('/api/auth/login').send(body)).body.token as string;
const me = (token?: string) =>
  request(app)
    .get('/api/auth/me')
    .set(token ? { Authorization: `Bearer ${token}` } : {});

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await request(app)
    .post('/api/users')
    .send({ ...credentials, firstName: 'Sara', lastName: 'Ahmadi' });
});

afterAll(async () => {
  await pool.end();
});

// REQ-3.1.5
describe('GET /api/auth/me', () => {
  it('returns the logged-in user for a valid token', async () => {
    const res = await me(await loginAs());

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'test@test.com', firstName: 'Sara' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('rejects a missing token', async () => {
    expect((await me()).status).toBe(401);
  });

  it('rejects a token that was never issued', async () => {
    expect((await me('f'.repeat(64))).status).toBe(401);
  });

  it('rejects a wrong auth scheme', async () => {
    const token = await loginAs();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Basic ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired session', async () => {
    const token = await loginAs();
    await pool.query(`UPDATE sessions SET expires_at = now() - interval '1 second'`);

    expect((await me(token)).status).toBe(401);
  });

  it('extends a live session each time it is used', async () => {
    const token = await loginAs();
    await pool.query(`UPDATE sessions SET expires_at = now() + interval '1 day'`);

    await me(token);

    const { rows } = await pool.query(
      `SELECT expires_at > now() + interval '6 days' AS extended FROM sessions`,
    );
    expect(rows[0].extended).toBe(true);
  });
});

// REQ-3.1.8
describe('POST /api/auth/logout', () => {
  it('ends the session so the token stops working', async () => {
    const token = await loginAs();

    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(out.status).toBe(204);
    expect((await me(token)).status).toBe(401);
    expect((await pool.query('SELECT 1 FROM sessions')).rowCount).toBe(0);
  });

  it('only ends the session it was called with', async () => {
    const phone = await loginAs();
    const tablet = await loginAs();

    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${phone}`);

    expect((await me(phone)).status).toBe(401);
    expect((await me(tablet)).status).toBe(200);
  });

  it('requires a session', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(401);
  });
});
