import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();
const credentials = { email: 'test@test.com', password: 'Test123@' };
const newPassword = 'Fresh456#';

const login = (password: string) =>
  request(app).post('/api/auth/login').send({ email: credentials.email, password });
const change = (token: string | undefined, body: object) =>
  request(app)
    .post('/api/auth/change-password')
    .set(token ? { Authorization: `Bearer ${token}` } : {})
    .send(body);

let token: string;

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await request(app)
    .post('/api/users')
    .send({ ...credentials, firstName: 'Sara', lastName: 'Ahmadi' });
  token = (await login(credentials.password)).body.token;
});

afterAll(async () => {
  await pool.end();
});

// REQ-3.1.7
describe('POST /api/auth/change-password', () => {
  it('changes the password so only the new one logs in', async () => {
    const res = await change(token, { currentPassword: credentials.password, newPassword });

    expect(res.status).toBe(200);
    expect((await login(newPassword)).status).toBe(200);
    expect((await login(credentials.password)).status).toBe(401);
  });

  it('stores the new password as a bcrypt hash', async () => {
    await change(token, { currentPassword: credentials.password, newPassword });

    const { rows } = await pool.query('SELECT password_hash FROM users');
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].password_hash).not.toContain(newPassword);
  });

  it('rejects a wrong current password and changes nothing', async () => {
    const res = await change(token, { currentPassword: 'Wrong123@', newPassword });

    expect(res.status).toBe(400);
    expect(res.body.errors.currentPassword).toBeDefined();
    expect((await login(credentials.password)).status).toBe(200);
  });

  it('rejects a weak new password', async () => {
    const res = await change(token, { currentPassword: credentials.password, newPassword: 'weak' });

    expect(res.status).toBe(400);
    expect(res.body.errors.newPassword).toBeDefined();
  });

  it('rejects reusing the current password', async () => {
    const res = await change(token, {
      currentPassword: credentials.password,
      newPassword: credentials.password,
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.newPassword).toBeDefined();
  });

  it('keeps this session and ends the user\'s other sessions', async () => {
    const otherDevice = (await login(credentials.password)).body.token;

    await change(token, { currentPassword: credentials.password, newPassword });

    const get = (t: string) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${t}`);
    expect((await get(token)).status).toBe(200);
    expect((await get(otherDevice)).status).toBe(401);
  });

  it('requires a logged-in user', async () => {
    const res = await change(undefined, { currentPassword: credentials.password, newPassword });
    expect(res.status).toBe(401);
  });

  it('treats missing fields as invalid input', async () => {
    expect((await change(token, {})).status).toBe(400);
  });
});
