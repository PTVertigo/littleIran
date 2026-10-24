import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';
import { browser, CSRF_TOKEN, setCookie } from './browser';

const app = createApp();
const credentials = { email: 'test@test.com', password: 'Test123@' };

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await browser(app)
    .post('/api/users')
    .send({ ...credentials, firstName: 'Sara', lastName: 'Ahmadi' });
});

afterAll(async () => {
  await pool.end();
});

describe('CSRF protection', () => {
  it('hands a first-time visitor a readable CSRF cookie', async () => {
    const res = await request(app).get('/api/health');

    const cookie = setCookie(res, 'csrf_token')!;
    expect(cookie).toMatch(/^csrf_token=[0-9a-f]{64};/);
    expect(cookie).not.toMatch(/HttpOnly/);
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; SameSite=Strict/);
  });

  it('keeps the CSRF cookie a visitor already has', async () => {
    const res = await browser(app).get('/api/health');
    expect(setCookie(res, 'csrf_token')).toBeUndefined();
  });

  it('refuses a state-changing request with no CSRF token', async () => {
    const res = await request(app).post('/api/auth/login').send(credentials);

    expect(res.status).toBe(403);
    expect(setCookie(res, 'sid')).toBeUndefined();
  });

  it('refuses a header that does not match the cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Cookie', `csrf_token=${CSRF_TOKEN}`)
      .set('X-CSRF-Token', 'd'.repeat(64))
      .send(credentials);

    expect(res.status).toBe(403);
  });

  it('refuses a header without the cookie, as a forged cross-site request would send', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-CSRF-Token', CSRF_TOKEN)
      .send(credentials);

    expect(res.status).toBe(403);
  });

  it('accepts a request whose header matches the cookie', async () => {
    const res = await browser(app).post('/api/auth/login').send(credentials);
    expect(res.status).toBe(200);
  });
});
