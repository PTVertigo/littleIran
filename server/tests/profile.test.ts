import { browser, sessionToken } from './browser';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();
const credentials = { email: 'test@test.com', password: 'Test123@' };

const loginAs = async (body = credentials) =>
  sessionToken(await browser(app).post('/api/auth/login').send(body))!;
const profile = (token?: string) => browser(app, token).get('/api/users/me');

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await browser(app).post('/api/users')
    .send({ ...credentials, firstName: 'Sara', lastName: 'Ahmadi' });
});

afterAll(async () => {
  await pool.end();
});

// REQ-3.2.1
describe('GET /api/users/me', () => {
  it('returns the logged-in user\'s email, names, registration date and role', async () => {
    const res = await profile(await loginAs());

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: 'test@test.com',
      firstName: 'Sara',
      lastName: 'Ahmadi',
      role: 'user',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it('shows the administrator role for an administrator', async () => {
    await pool.query("UPDATE users SET role = 'admin'");

    const res = await profile(await loginAs());

    expect(res.body.user.role).toBe('admin');
  });

  it('never includes the password hash or reset token', async () => {
    await browser(app).post('/api/auth/forgot-password').send({ email: credentials.email });

    const res = await profile(await loginAs());

    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|token|locked/i);
  });

  it('only shows the account that owns the session', async () => {
    await browser(app).post('/api/users')
      .send({ email: 'other@test.com', password: 'Other123@', firstName: 'Omid', lastName: 'Rad' });

    const res = await profile(await loginAs({ email: 'other@test.com', password: 'Other123@' }));

    expect(res.body.user).toMatchObject({ email: 'other@test.com', firstName: 'Omid' });
  });

  it('rejects a request with no session', async () => {
    expect((await profile()).status).toBe(401);
  });

  it('rejects a token that was never issued', async () => {
    expect((await profile('f'.repeat(64))).status).toBe(401);
  });
});
