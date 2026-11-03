import request from 'supertest';
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

const update = (body: object, token?: string) => browser(app, token).put('/api/users/me').send(body);

// REQ-3.2.2
describe('PUT /api/users/me', () => {
  it('changes the first and last name and returns the updated profile', async () => {
    const token = await loginAs();

    const res = await update({ firstName: 'Sarah', lastName: 'Ahmadi-Rad' }, token);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'test@test.com', firstName: 'Sarah', lastName: 'Ahmadi-Rad' });
    expect((await profile(token)).body.user).toMatchObject({ firstName: 'Sarah', lastName: 'Ahmadi-Rad' });
    expect((await browser(app, token).get('/api/auth/me')).body.user.firstName).toBe('Sarah');
  });

  it('can be done again at any time', async () => {
    const token = await loginAs();

    await update({ firstName: 'Sarah', lastName: 'Rad' }, token);
    await update({ firstName: 'Sara', lastName: 'Ahmadi' }, token);

    expect((await profile(token)).body.user).toMatchObject({ firstName: 'Sara', lastName: 'Ahmadi' });
  });

  it('trims the names', async () => {
    const res = await update({ firstName: '  Sarah ', lastName: ' Rad  ' }, await loginAs());

    expect(res.body.user).toMatchObject({ firstName: 'Sarah', lastName: 'Rad' });
  });

  it('does not change the email, role or registration date, whatever else the request carries', async () => {
    const token = await loginAs();
    const before = (await profile(token)).body.user;

    await update({ firstName: 'Sarah', lastName: 'Rad', email: 'evil@test.com', role: 'admin', id: '99', createdAt: '2001-01-01' }, token);

    expect((await profile(token)).body.user).toEqual({ ...before, firstName: 'Sarah', lastName: 'Rad' });
  });

  it('only changes the logged-in user\'s own account', async () => {
    await browser(app).post('/api/users')
      .send({ email: 'other@test.com', password: 'Other123@', firstName: 'Omid', lastName: 'Rad' });

    await update({ id: '2', firstName: 'Hacked', lastName: 'Hacked' }, await loginAs());

    const { rows } = await pool.query('SELECT first_name FROM users WHERE email = $1', ['other@test.com']);
    expect(rows[0].first_name).toBe('Omid');
  });

  it.each([
    ['an empty first name', { firstName: '', lastName: 'Rad' }, ['firstName']],
    ['a blank last name', { firstName: 'Sarah', lastName: '   ' }, ['lastName']],
    ['both names missing', {}, ['firstName', 'lastName']],
    ['names that are not text', { firstName: 5, lastName: { a: 1 } }, ['firstName', 'lastName']],
    ['a first name over 50 characters', { firstName: 'a'.repeat(51), lastName: 'Rad' }, ['firstName']],
  ])('rejects %s and leaves the profile alone', async (_name, body, fields) => {
    const token = await loginAs();

    const res = await update(body, token);

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors)).toEqual(fields);
    expect((await profile(token)).body.user).toMatchObject({ firstName: 'Sara', lastName: 'Ahmadi' });
  });

  // REQ-4.1.1 and REQ-4.1.3 input is stored as typed; the web app escapes it on display
  it('stores markup and SQL text as plain text', async () => {
    const token = await loginAs();
    const firstName = "Robert'); DROP TABLE users;--";
    const lastName = '<script>alert(1)</script>';

    const res = await update({ firstName, lastName }, token);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ firstName, lastName });
    expect((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n).toBe(1);
  });

  it('rejects a request with no session', async () => {
    expect((await update({ firstName: 'A', lastName: 'B' })).status).toBe(401);
  });

  // REQ-4.1.4 state-changing requests need the CSRF token
  it('rejects a request without the CSRF token', async () => {
    const token = await loginAs();

    const res = await request(app)
      .put('/api/users/me')
      .set('Cookie', `sid=${token}`)
      .send({ firstName: 'Sarah', lastName: 'Rad' });

    expect(res.status).toBe(403);
    expect((await profile(token)).body.user.firstName).toBe('Sara');
  });
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
      status: 'active',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  // REQ-3.2.5
  it('says an account is active when it is', async () => {
    const res = await profile(await loginAs());

    expect(res.body.user.status).toBe('active');
  });

  it('says an account is inactive once it has been deactivated', async () => {
    const token = await loginAs();
    await pool.query("UPDATE users SET status = 'inactive'");

    const res = await profile(token);

    expect(res.body.user.status).toBe('inactive');
  });

  it('keeps the status when the names are updated, and does not let the request change it', async () => {
    await pool.query("UPDATE users SET status = 'inactive'");
    const token = await loginAs();

    const res = await update({ firstName: 'Sarah', lastName: 'Rad', status: 'active' }, token);

    expect(res.body.user.status).toBe('inactive');
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
