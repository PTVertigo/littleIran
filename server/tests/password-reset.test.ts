import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';
import { sendPasswordResetEmail } from '../src/email';
import { hashToken } from '../src/tokens';

jest.mock('../src/email');

const app = createApp();
const credentials = { email: 'test@test.com', password: 'Test123@' };
const newPassword = 'Fresh456#';

const mockedSend = jest.mocked(sendPasswordResetEmail);
const forgot = (email: string) => request(app).post('/api/auth/forgot-password').send({ email });
const reset = (token: string, password = newPassword) =>
  request(app).post('/api/auth/reset-password').send({ token, password });
const login = (password: string) =>
  request(app).post('/api/auth/login').send({ email: credentials.email, password });

// Pulls the token out of the link the mocked email sender received
async function requestResetToken() {
  await forgot(credentials.email);
  const link = mockedSend.mock.calls.at(-1)![1];
  return new URL(link).searchParams.get('token')!;
}

beforeEach(async () => {
  mockedSend.mockClear();
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await request(app)
    .post('/api/users')
    .send({ ...credentials, firstName: 'Sara', lastName: 'Ahmadi' });
});

afterAll(async () => {
  await pool.end();
});

// REQ-3.1.6
describe('POST /api/auth/forgot-password', () => {
  it('emails a deep link to a registered address and stores only the token hash', async () => {
    const res = await forgot('Test@Test.com');

    expect(res.status).toBe(202);
    expect(mockedSend).toHaveBeenCalledTimes(1);
    const [to, link] = mockedSend.mock.calls[0];
    expect(to).toBe('test@test.com');
    expect(link).toMatch(/^littleiran:\/\/reset-password\?token=[0-9a-f]{64}$/);

    const token = new URL(link).searchParams.get('token')!;
    const { rows } = await pool.query('SELECT reset_token_hash FROM users');
    expect(rows[0].reset_token_hash).toBe(hashToken(token));
  });

  it('gives an unknown address the same answer and sends nothing', async () => {
    const known = await forgot(credentials.email);
    mockedSend.mockClear();
    const unknown = await forgot('nobody@test.com');

    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('rejects a malformed address', async () => {
    expect((await forgot('not-an-email')).status).toBe(400);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('invalidates the previous link when a new one is requested', async () => {
    const first = await requestResetToken();
    const second = await requestResetToken();

    expect((await reset(first)).status).toBe(400);
    expect((await reset(second)).status).toBe(200);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('sets the new password so only it works for login', async () => {
    const token = await requestResetToken();

    expect((await reset(token)).status).toBe(200);
    expect((await login(newPassword)).status).toBe(200);
    expect((await login(credentials.password)).status).toBe(401);
  });

  it('works only once', async () => {
    const token = await requestResetToken();

    await reset(token);
    const again = await reset(token, 'Another789$');

    expect(again.status).toBe(400);
    expect((await login(newPassword)).status).toBe(200);
  });

  it('rejects an expired link', async () => {
    const token = await requestResetToken();
    await pool.query(`UPDATE users SET reset_token_expires_at = now() - interval '1 second'`);

    const res = await reset(token);

    expect(res.status).toBe(400);
    expect((await login(credentials.password)).status).toBe(200);
  });

  it('rejects a token that was never issued', async () => {
    expect((await reset('f'.repeat(64))).status).toBe(400);
  });

  it('rejects a weak password without using up the link', async () => {
    const token = await requestResetToken();

    const weak = await reset(token, 'weak');
    expect(weak.status).toBe(400);
    expect(weak.body.errors.password).toBeDefined();
    expect((await reset(token)).status).toBe(200);
  });

  it('logs out every existing session', async () => {
    const session = (await login(credentials.password)).body.token;
    const token = await requestResetToken();

    await reset(token);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${session}`);
    expect(me.status).toBe(401);
  });

  it('clears a lockout so the user can log in with the new password', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 5; i++) await login('Wrong123@');
    expect((await login(credentials.password)).status).toBe(423);

    const token = await requestResetToken();
    await reset(token);

    expect((await login(newPassword)).status).toBe(200);
  });
});
