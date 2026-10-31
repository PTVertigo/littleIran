import { browser, sessionToken } from './browser';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();
const credentials = { email: 'test@test.com', password: 'Test123@' };
const SQL_PAYLOADS = ["' OR '1'='1", "test@test.com'--", "'; DROP TABLE users;--"];

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await browser(app).post('/api/users')
    .send({ ...credentials, firstName: 'Sara', lastName: 'Ahmadi' });
});

afterAll(async () => {
  await pool.end();
});

async function userCount() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
  return rows[0].n as number;
}

// SEC-001 (REQ-4.1.1) SQL is always parameterized, so input is only ever data
describe('SQL injection attempts', () => {
  it.each(SQL_PAYLOADS)('cannot log in with the email %s', async (payload) => {
    const res = await browser(app).post('/api/auth/login')
      .send({ email: payload, password: credentials.password });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
    expect(sessionToken(res)).toBeUndefined();
  });

  it.each(SQL_PAYLOADS)('cannot log in with the password %s', async (payload) => {
    const res = await browser(app).post('/api/auth/login')
      .send({ email: credentials.email, password: payload });

    expect(res.status).toBe(401);
    expect(sessionToken(res)).toBeUndefined();
  });

  it('stores a payload in a name as plain text and leaves the table intact', async () => {
    const payload = "Robert'); DROP TABLE users;--";
    const res = await browser(app).post('/api/users')
      .send({ email: 'bobby@tables.com', password: 'Test123@', firstName: payload, lastName: 'Tables' });

    expect(res.status).toBe(201);
    const { rows } = await pool.query('SELECT first_name FROM users WHERE email = $1', [
      'bobby@tables.com',
    ]);
    expect(rows[0].first_name).toBe(payload);
    expect(await userCount()).toBe(2);
  });

  it('treats a well-formed email that carries a payload as just another address', async () => {
    const res = await browser(app).post('/api/auth/forgot-password')
      .send({ email: "a'OR'1'='1@example.com" });

    expect(res.status).toBe(202);
    const { rows } = await pool.query('SELECT reset_token_hash FROM users');
    expect(rows[0].reset_token_hash).toBeNull();
  });

  it('cannot reset a password by sending a payload as the reset token', async () => {
    const res = await browser(app).post('/api/auth/reset-password')
      .send({ token: "' OR '1'='1", password: 'Hacked1!' });

    expect(res.status).toBe(400);
    const login = await browser(app).post('/api/auth/login').send(credentials);
    expect(login.status).toBe(200);
  });
});

// UT-004 (REQ-4.1.3) the API hands user text back as JSON data, never as HTML; the web app escapes it
describe('Script in user-supplied text', () => {
  const script = "<script>alert('xss')</script>";

  it('is stored and returned verbatim as a JSON string', async () => {
    const res = await browser(app).post('/api/users')
      .send({ email: 'xss@example.com', password: 'Test123@', firstName: script, lastName: 'Tester' });

    expect(res.status).toBe(201);
    expect(res.type).toBe('application/json');
    expect(res.body.firstName).toBe(script);
  });
});
