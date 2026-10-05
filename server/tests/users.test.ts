import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../src/app';
import { pool } from '../src/db';

const app = createApp();
const validBody = {
  email: 'Test@Domain.com',
  password: 'Test123!@',
  firstName: 'Sara',
  lastName: 'Ahmadi',
};

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// API-001 (REQ-3.1.1, 4.1.2)
describe('POST /api/users', () => {
  it('registers a user and never returns the password', async () => {
    const res = await request(app).post('/api/users').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: 'test@domain.com',
      firstName: 'Sara',
      lastName: 'Ahmadi',
      role: 'user',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  // UT-001 (REQ-4.1.2)
  it('stores a bcrypt hash instead of the plaintext password', async () => {
    await request(app).post('/api/users').send(validBody);

    const { rows } = await pool.query('SELECT password_hash FROM users');
    expect(rows[0].password_hash).not.toBe(validBody.password);
    expect(await bcrypt.compare(validBody.password, rows[0].password_hash)).toBe(true);
  });

  // REQ-3.1.2
  it('rejects an email that is already registered, ignoring case', async () => {
    await request(app).post('/api/users').send(validBody);
    const res = await request(app)
      .post('/api/users')
      .send({ ...validBody, email: 'TEST@domain.COM' });

    expect(res.status).toBe(409);
    expect(res.body.errors.email).toBeDefined();
  });

  it('reports every invalid field at once', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'nope', password: 'weak', firstName: ' ', lastName: '' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual([
      'email',
      'firstName',
      'lastName',
      'password',
    ]);
  });

  it('rejects a request with no body', async () => {
    const res = await request(app).post('/api/users');
    expect(res.status).toBe(400);
  });

  it('answers malformed JSON with a plain error and no internals', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|stack|node_modules/);
  });
});
