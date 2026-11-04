// The test cases named in the Milestone 4 document's test plan (section 5), one test per case, using the
// document's own input and checking its expected output. Every test title starts with the document's ID,
// so a single case can be run by itself:
//   npm run test:plan:server -- -t "UT-003"
// The same cases also exist, in more depth, in the feature test files; this file is the traceable set.
import bcrypt from 'bcrypt';
import request from 'supertest';
import { browser, sessionToken, setCookie } from './browser';
import { createApp } from '../src/app';
import { validateBusiness } from '../src/business-validation';
import { pool } from '../src/db';
import { isStrongPassword, isValidEmail } from '../src/validation';

const app = createApp();

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

const register = (email: string, password: string) =>
  browser(app).post('/api/users').send({ email, password, firstName: 'Sara', lastName: 'Ahmadi' });
const login = (email: string, password: string) => browser(app).post('/api/auth/login').send({ email, password });

// ---------------------------------------------------------------------------------------------------------
// 5.2 Unit testing (Jest)
// ---------------------------------------------------------------------------------------------------------
describe('Unit tests', () => {
  // NF 4.1.2 · input: plaintext password `Test123!@` · expected: bcrypt hash returned, plaintext not stored
  it('UT-001 password hashing: Test123!@ is stored as a bcrypt hash, never as plaintext', async () => {
    await register('ut001@test.com', 'Test123!@');

    const { rows } = await pool.query('SELECT password_hash FROM users');

    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(rows[0].password_hash).not.toContain('Test123!@');
    expect(await bcrypt.compare('Test123!@', rows[0].password_hash)).toBe(true);
  });

  // F1.2 · input: valid `test@domain.com`, invalid `test@invalid` · expected: true / false
  it('UT-002 email format checker: test@domain.com is valid and test@invalid is not', () => {
    expect(isValidEmail('test@domain.com')).toBe(true);
    expect(isValidEmail('test@invalid')).toBe(false);
  });

  // F1.3 · input: `weak`, `Strong1!`, `Strong1@` · expected: only `Strong1!` and `Strong1@` pass
  it('UT-003 password strength: only Strong1! and Strong1@ pass, weak does not', () => {
    expect(isStrongPassword('weak')).toBe(false);
    expect(isStrongPassword('Strong1!')).toBe(true);
    expect(isStrongPassword('Strong1@')).toBe(true);
  });

  // NF 4.1.3 · input: `<script>alert('xss')</script>` · expected: script tags escaped or removed.
  // The API keeps the text as plain JSON data; the web app escapes it when showing it (see the web plan tests).
  it('UT-004 XSS: <script>alert(\'xss\')</script> comes back as plain JSON text and is never treated as HTML', async () => {
    const script = "<script>alert('xss')</script>";

    const res = await browser(app).post('/api/users')
      .send({ email: 'ut004@test.com', password: 'Test123@', firstName: script, lastName: 'Tester' });

    expect(res.status).toBe(201);
    expect(res.type).toBe('application/json');
    expect(res.body.firstName).toBe(script);
    expect(res.headers['content-type']).not.toMatch(/html/);
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  });

  // F3.1, F3.2 · input: business object with missing required fields · expected: validation errors
  it('UT-005 business listing validation: an object with missing required fields returns validation errors', () => {
    const { errors, value } = validateBusiness({ name: 'Darband Restaurant' });

    expect(value).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual(
      ['categoryId', 'city', 'description', 'email', 'hours', 'phone', 'postalCode', 'street'],
    );
  });
});

// ---------------------------------------------------------------------------------------------------------
// 5.3 API testing (Jest + supertest)
// ---------------------------------------------------------------------------------------------------------
describe('API tests', () => {
  // F1.1, NF 4.1.2 · POST /api/users with valid email and password · expected: 201, hashed password
  it('API-001 user registration: POST /api/users answers 201 and stores a hashed password', async () => {
    const res = await register('api001@test.com', 'Test123@');

    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    const { rows } = await pool.query('SELECT password_hash FROM users');
    expect(rows[0].password_hash).not.toBe('Test123@');
    expect(rows[0].password_hash).toMatch(/^\$2/);
  });

  // F1.4, F1.5 · POST /api/auth/login with credentials · expected: 200, session token returned
  it('API-002 user login: POST /api/auth/login answers 200 with a session token', async () => {
    await register('test@test.com', 'Test123@');

    const res = await login('test@test.com', 'Test123@');

    expect(res.status).toBe(200);
    expect(sessionToken(res)).toMatch(/^[0-9a-f]{64}$/);
  });

  // F3.1, F3.3 · POST /api/businesses with listing data · expected: 201, listing created (pending approval)
  it('API-003 business listing creation: POST /api/businesses answers 201 and the listing is pending', async () => {
    await register('owner@test.com', 'Test123@');
    const token = sessionToken(await login('owner@test.com', 'Test123@'))!;
    const { rows: category } = await pool.query("SELECT id FROM categories WHERE type = 'business' AND name = 'Restaurant'");

    const res = await browser(app, token).post('/api/businesses').send({
      name: 'Darband Restaurant',
      categoryId: category[0].id,
      description: 'Mountain-style Persian dining.',
      street: '45 Example Road',
      city: 'Mississauga',
      postalCode: 'L5B 1B2',
      phone: '905-555-0102',
      email: 'info@darband.example.com',
      website: 'https://example.com/darband',
      hours: [{ day: 1, opens: '12:00', closes: '23:00' }],
    });

    expect(res.status).toBe(201);
    expect(res.body.business.status).toBe('pending');
    const { rows } = await pool.query('SELECT status FROM businesses');
    expect(rows).toEqual([{ status: 'pending' }]);
  });

  // NF 4.1.1 · GET /api/businesses?search='; DROP TABLE-- · expected: 200, query safely parameterized
  it("API-004 search with SQL injection: GET /api/businesses?search='; DROP TABLE-- answers 200 and drops nothing", async () => {
    const res = await request(app).get('/api/businesses').query({ search: "'; DROP TABLE--" });

    expect(res.status).toBe(200);
    expect(res.body.businesses).toEqual([]);
    const { rows } = await pool.query("SELECT to_regclass('public.businesses') AS businesses, to_regclass('public.users') AS users");
    expect(rows[0]).toEqual({ businesses: 'businesses', users: 'users' });
  });

  // F4.2, NF 4.1.4 · POST /api/admin/approve as a non-admin user · expected: 403 Forbidden.
  // The admin endpoints are built in Milestone 3 (Week 9), so this case cannot run yet.
  it.todo('API-005 admin approval authorization: POST /api/admin/approve as a non-admin answers 403 (built in Milestone 3, Week 9)');
});

// ---------------------------------------------------------------------------------------------------------
// 5.5 Security testing: the cases that can be checked at the API level (the ZAP scans SEC-001 and SEC-002
// are run in OWASP ZAP; see TEST-PLAN.md)
// ---------------------------------------------------------------------------------------------------------
describe('Security tests', () => {
  // NF 4.1.5 · scan for unencrypted communication · expected: all traffic uses HTTPS only
  it('SEC-003 HTTPS only: in production every response tells browsers to use HTTPS for a year (HSTS)', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app).get('/api/health');
      expect(res.headers['strict-transport-security']).toBe('max-age=31536000');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  // NF 4.1.4 · verify HttpOnly and Secure flags on cookies · expected: session cookies properly configured
  it('SEC-004 session hijacking prevention: the session cookie is HttpOnly, Secure and SameSite', async () => {
    await register('test@test.com', 'Test123@');

    const cookie = setCookie(await login('test@test.com', 'Test123@'), 'sid')!;

    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; SameSite=Lax/);
  });

  // F1.9, NF 4.1.6 · 5 failed login attempts within 15 minutes · expected: account locked for 30 minutes
  it('SEC-005 account lockout: 5 failed logins within 15 minutes lock the account for 30 minutes', async () => {
    await register('test@test.com', 'Test123@');

    for (let i = 1; i <= 4; i++) expect((await login('test@test.com', 'Wrong123@')).status).toBe(401);
    expect((await login('test@test.com', 'Wrong123@')).status).toBe(423);

    expect((await login('test@test.com', 'Test123@')).status).toBe(423);
    const { rows } = await pool.query("SELECT locked_until > now() + interval '29 minutes' AS locked FROM users");
    expect(rows[0].locked).toBe(true);
  });
});
