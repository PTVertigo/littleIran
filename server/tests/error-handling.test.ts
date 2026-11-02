import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';
import request from 'supertest';
import { browser } from './browser';
import { createApp } from '../src/app';
import { pool } from '../src/db';

let webDist: string;

beforeAll(() => {
  webDist = mkdtempSync(path.join(tmpdir(), 'littleiran-web-'));
  writeFileSync(path.join(webDist, 'index.html'), '<!doctype html><title>LittleIran</title>');
});

afterAll(async () => {
  rmSync(webDist, { recursive: true, force: true });
  await pool.end();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// REQ-4.2: clear, non-technical errors that never expose stack traces, paths or database details
describe('Error handling', () => {
  const app = createApp();

  it('answers an unknown API address with JSON, not the framework\'s HTML page', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.type).toBe('application/json');
    expect(res.body).toEqual({ error: 'Not found.' });
  });

  it.each(['/%', '/api/%', '/%E0%A4%A'])('treats the malformed address %s as a client mistake, not a server crash', async (address) => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(createApp({ webDist })).get(address);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'That request could not be understood.' });
    expect(error).not.toHaveBeenCalled();
  });

  it('refuses an oversized request body with 413', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await browser(app).post('/api/auth/login').send({ email: 'a'.repeat(200_000) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'That request is too large.' });
    expect(error).not.toHaveBeenCalled();
  });

  describe('when the server itself fails', () => {
    // What a unique-violation error from pg looks like: the message is safe, `detail` holds the values
    const databaseError = () =>
      Object.assign(new Error('duplicate key value violates unique constraint "users_email_lower_idx"'), {
        code: '23505',
        detail: 'Key (lower(email))=(secret@test.com) already exists.',
      });

    // pool.query has many overloads, so jest infers `never` for what it can reject with
    const failNextQuery = () => jest.spyOn(pool, 'query').mockRejectedValueOnce(databaseError() as never);

    it('tells the client nothing about the cause', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      failNextQuery();

      const res = await browser(app).post('/api/auth/login').send({ email: 'secret@test.com', password: 'Test123@' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Something went wrong. Please try again.' });
      expect(res.text).not.toMatch(/duplicate|constraint|secret@test\.com|users_email|\bat .*\.ts/);
    });

    it('logs the failure, but without the values the failing query carried', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      failNextQuery();

      await browser(app).post('/api/auth/login').send({ email: 'secret@test.com', password: 'Test123@' });

      const logged = inspect(error.mock.calls, { depth: null });
      expect(logged).toContain('duplicate key value violates unique constraint');
      expect(logged).not.toContain('secret@test.com');
    });
  });

  it('keeps the server running when the database drops an idle connection', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    // With no listener on the pool, emitting 'error' throws, which on a real idle client stops Node
    expect(() => pool.emit('error', new Error('terminating connection due to administrator command'))).not.toThrow();
    expect(error).toHaveBeenCalledWith(
      'Database connection error:',
      'terminating connection due to administrator command',
    );
  });
});
