import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();
const credentials = { email: 'test@test.com', password: 'Test123@' };
const wrong = { ...credentials, password: 'Wrong123@' };

const login = (body: object) => request(app).post('/api/auth/login').send(body);

async function failTimes(n: number) {
  for (let i = 0; i < n; i++) await login(wrong);
}

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await request(app)
    .post('/api/users')
    .send({ ...credentials, firstName: 'Sara', lastName: 'Ahmadi' });
});

afterAll(async () => {
  await pool.end();
});

// SEC-005 (REQ-3.1.9, 4.1.6)
describe('account lockout', () => {
  it('keeps answering 401 for the first four failures', async () => {
    for (let i = 0; i < 4; i++) {
      expect((await login(wrong)).status).toBe(401);
    }
  });

  it('locks the account on the fifth failure', async () => {
    await failTimes(4);
    const res = await login(wrong);

    expect(res.status).toBe(423);
    const { rows } = await pool.query(
      `SELECT locked_until > now() + interval '29 minutes' AS locked FROM users`,
    );
    expect(rows[0].locked).toBe(true);
  });

  it('refuses even the correct password while locked, and creates no session', async () => {
    await failTimes(5);
    const res = await login(credentials);

    expect(res.status).toBe(423);
    expect((await pool.query('SELECT 1 FROM sessions')).rowCount).toBe(0);
  });

  it('allows login again once the 30 minutes have passed', async () => {
    await failTimes(5);
    await pool.query(`UPDATE users SET locked_until = now() - interval '1 minute'`);

    expect((await login(credentials)).status).toBe(200);
  });

  it('starts a fresh count after a lock expires', async () => {
    await failTimes(5);
    await pool.query(
      `UPDATE users SET locked_until = now() - interval '1 minute',
                        first_failed_login_at = now() - interval '31 minutes'`,
    );

    expect((await login(wrong)).status).toBe(401);
    const { rows } = await pool.query('SELECT failed_login_count FROM users');
    expect(rows[0].failed_login_count).toBe(1);
  });

  it('does not count failures that are more than 15 minutes apart', async () => {
    await failTimes(4);
    await pool.query(`UPDATE users SET first_failed_login_at = now() - interval '16 minutes'`);

    expect((await login(wrong)).status).toBe(401);
    const { rows } = await pool.query('SELECT failed_login_count, locked_until FROM users');
    expect(rows[0]).toEqual({ failed_login_count: 1, locked_until: null });
  });

  it('resets the failure count after a successful login', async () => {
    await failTimes(4);
    expect((await login(credentials)).status).toBe(200);

    await failTimes(4);
    expect((await login(wrong)).status).toBe(423);
  });

  it('counts failures per account, not per request source', async () => {
    await request(app)
      .post('/api/users')
      .send({ email: 'other@test.com', password: 'Test123@', firstName: 'Ali', lastName: 'Rad' });
    await failTimes(5);

    expect((await login({ email: 'other@test.com', password: 'Test123@' })).status).toBe(200);
  });

  it('does not lock anything for an unknown email', async () => {
    for (let i = 0; i < 6; i++) {
      expect((await login({ email: 'ghost@test.com', password: 'x' })).status).toBe(401);
    }
  });

  it('survives simultaneous wrong guesses without losing count', async () => {
    await Promise.all(Array.from({ length: 5 }, () => login(wrong)));

    const { rows } = await pool.query('SELECT failed_login_count, locked_until FROM users');
    expect(rows[0].failed_login_count).toBe(5);
    expect(rows[0].locked_until).not.toBeNull();
  });
});
