import { inspect } from 'node:util';
import { browser, sessionToken } from './browser';
import { createApp } from '../src/app';
import { pool } from '../src/db';
import { sendPasswordResetEmail } from '../src/email';

jest.mock('../src/email');

const app = createApp();
const mockedSend = jest.mocked(sendPasswordResetEmail);
const email = 'sara.log@test.com';
const password = 'Test123@';
const newPassword = 'Fresh456#';

let warn: jest.SpyInstance;
let info: jest.SpyInstance;
let userId: string;

const logged = () => inspect([...warn.mock.calls, ...info.mock.calls], { depth: null });
const login = (pass = password) => browser(app).post('/api/auth/login').send({ email, password: pass });

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  const res = await browser(app).post('/api/users').send({ email, password, firstName: 'Sara', lastName: 'Ahmadi' });
  userId = String(res.body.id);
  mockedSend.mockClear();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  info = jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

// REQ-4.2: log login attempts, lockouts and unauthorized access, with ids only
describe('Security log', () => {
  it('records a failed login against the account id, not the email or the password guess', async () => {
    await login('Wrong123@');

    expect(logged()).toContain('security: login failed');
    expect(logged()).toMatch(new RegExp(`userId: '${userId}'`));
    expect(logged()).not.toContain(email);
    expect(logged()).not.toContain('Wrong123@');
  });

  it('records a login for an unknown email without saying which email', async () => {
    await browser(app).post('/api/auth/login').send({ email: 'nobody@test.com', password });

    expect(logged()).toContain('login failed for an unknown account');
    expect(logged()).not.toContain('nobody@test.com');
  });

  it('records a successful login and logout, without the session token', async () => {
    const res = await login();
    const token = sessionToken(res)!;
    await browser(app, token).post('/api/auth/logout');

    expect(logged()).toContain('security: login succeeded');
    expect(logged()).toContain('security: logout');
    expect(logged()).toMatch(new RegExp(`userId: '${userId}'`));
    expect(logged()).not.toContain(token);
  });

  it('records a lockout', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) await login('Wrong123@');

    expect(logged()).toContain('security: account locked after repeated failed logins');
  });

  it('records a request with no session to a protected address, without its query string', async () => {
    await browser(app).get('/api/auth/me?token=abc123');

    expect(logged()).toContain('security: unauthorized request');
    expect(logged()).toContain("path: '/api/auth/me'");
    expect(logged()).not.toContain('abc123');
  });

  it('records a password change and a refused one, without either password', async () => {
    const token = sessionToken(await login())!;
    await browser(app, token).post('/api/auth/change-password').send({ currentPassword: 'Wrong123@', newPassword });
    await browser(app, token).post('/api/auth/change-password').send({ currentPassword: password, newPassword });

    expect(logged()).toContain('password change refused for a wrong current password');
    expect(logged()).toContain('security: password changed');
    for (const secret of [password, 'Wrong123@', newPassword]) expect(logged()).not.toContain(secret);
  });

  it('records a password reset from request to completion, without the token or the email', async () => {
    await browser(app).post('/api/auth/forgot-password').send({ email });
    const link = mockedSend.mock.calls[0][1];
    const token = new URL(link).searchParams.get('token')!;
    await browser(app).post('/api/auth/reset-password').send({ token, password: newPassword });
    await browser(app).post('/api/auth/reset-password').send({ token, password: newPassword });
    await browser(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.com' });

    expect(logged()).toContain('security: password reset requested');
    expect(logged()).toContain('security: password reset completed');
    expect(logged()).toContain('password reset refused for an invalid or expired link');
    expect(logged()).toContain('password reset requested for an unknown account');
    for (const secret of [token, newPassword, email, 'nobody@test.com']) expect(logged()).not.toContain(secret);
  });
});
