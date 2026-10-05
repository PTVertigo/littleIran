import { createHash } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();
const credentials = { email: 'test@test.com', password: 'Test123@' };

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await request(app)
    .post('/api/users')
    .send({ ...credentials, firstName: 'Sara', lastName: 'Ahmadi' });
});

afterAll(async () => {
  await pool.end();
});

// API-002 (REQ-3.1.4, 3.1.5)
describe('POST /api/auth/login', () => {
  it('logs in with valid credentials and returns a session token', async () => {
    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(res.body.user).toMatchObject({ email: 'test@test.com', firstName: 'Sara' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('accepts the email in a different case', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, email: 'TEST@Test.com' });
    expect(res.status).toBe(200);
  });

  it('stores only a hash of the session token and records the login time', async () => {
    const res = await request(app).post('/api/auth/login').send(credentials);

    const hash = createHash('sha256').update(res.body.token).digest('hex');
    const sessions = await pool.query('SELECT token_hash FROM sessions');
    expect(sessions.rows).toEqual([{ token_hash: hash }]);

    const users = await pool.query('SELECT last_login_at FROM users');
    expect(users.rows[0].last_login_at).not.toBeNull();
  });

  it('gives each login its own token', async () => {
    const first = await request(app).post('/api/auth/login').send(credentials);
    const second = await request(app).post('/api/auth/login').send(credentials);
    expect(first.body.token).not.toBe(second.body.token);
  });

  // FE-002 (REQ-3.1.4)
  it('answers a wrong password with Invalid credentials and no session', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ ...credentials, password: 'Wrong123@' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
    const sessions = await pool.query('SELECT 1 FROM sessions');
    expect(sessions.rowCount).toBe(0);
  });

  it('answers an unknown email exactly like a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Test123@' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it.each([{}, { email: 'test@test.com' }, { password: 'Test123@' }, { email: 5, password: 5 }])(
    'rejects incomplete credentials %p',
    async (body) => {
      const res = await request(app).post('/api/auth/login').send(body);
      expect(res.status).toBe(401);
    },
  );
});
