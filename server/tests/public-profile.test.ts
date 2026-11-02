import request from 'supertest';
import { browser, sessionToken } from './browser';
import { createApp } from '../src/app';
import { pool } from '../src/db';
import { countSubmissions } from '../src/submissions';

jest.mock('../src/submissions');

const app = createApp();
const viewer = { email: 'viewer@test.com', password: 'Test123@' };
const mockedCount = jest.mocked(countSubmissions);

let viewerToken: string;
let sara: string;

const register = async (email: string, firstName: string, lastName: string) =>
  (await browser(app).post('/api/users').send({ email, password: 'Test123@', firstName, lastName })).body.id as string;
const publicProfile = (id: string, token: string | undefined = viewerToken) =>
  browser(app, token).get(`/api/users/${encodeURIComponent(id)}`);

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  mockedCount.mockReset().mockResolvedValue(0);
  await register(viewer.email, 'Vida', 'Viewer');
  sara = await register('sara@test.com', 'Sara', 'Ahmadi');
  viewerToken = sessionToken(await browser(app).post('/api/auth/login').send(viewer))!;
});

afterAll(async () => {
  await pool.end();
});

// REQ-3.2.3
describe('GET /api/users/:id', () => {
  it('shows another member\'s name and submission count', async () => {
    mockedCount.mockResolvedValue(3);

    const res = await publicProfile(sara);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: sara, firstName: 'Sara', lastName: 'Ahmadi', submissionCount: 3 });
    expect(mockedCount).toHaveBeenCalledWith(sara);
  });

  it('shows a count of 0 for someone who has submitted nothing', async () => {
    expect((await publicProfile(sara)).body.user.submissionCount).toBe(0);
  });

  it('shares nothing beyond the name and the count', async () => {
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [sara]);

    const res = await publicProfile(sara);

    expect(Object.keys(res.body.user).sort()).toEqual(['firstName', 'id', 'lastName', 'submissionCount']);
    expect(JSON.stringify(res.body)).not.toMatch(/sara@test\.com|admin|password|hash|token|active|createdAt/i);
  });

  it('works for the viewer\'s own id too', async () => {
    const own = (await browser(app, viewerToken).get('/api/users/me')).body.user.id;

    expect((await publicProfile(own)).body.user.firstName).toBe('Vida');
  });

  it('does not swallow /me, which is still the viewer\'s own profile', async () => {
    const res = await browser(app, viewerToken).get('/api/users/me');

    expect(res.body.user).toMatchObject({ email: viewer.email, role: 'user' });
  });

  it('does not show a deactivated account', async () => {
    await pool.query("UPDATE users SET status = 'inactive' WHERE id = $1", [sara]);

    const res = await publicProfile(sara);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'User not found.' });
  });

  it('says not found for an id nobody has', async () => {
    expect((await publicProfile('9999')).status).toBe(404);
  });

  // REQ-4.1.1 and REQ-4.2.4 an id that is not a number is a missing user, never a database error
  it.each(['abc', '0', '-1', '1.5', '1 OR 1=1', "1'; DROP TABLE users;--", '9'.repeat(30), '%00'])(
    'says not found for the id %p without touching the database',
    async (id) => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await publicProfile(id);

      expect(res.status).toBe(404);
      expect(error).not.toHaveBeenCalled();
      expect((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n).toBe(2);
      error.mockRestore();
    },
  );

  it('asks a visitor with no session to log in', async () => {
    const res = await request(app).get(`/api/users/${sara}`);

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('Sara');
  });

  it('rejects a token that was never issued', async () => {
    expect((await publicProfile(sara, 'f'.repeat(64))).status).toBe(401);
  });
});
