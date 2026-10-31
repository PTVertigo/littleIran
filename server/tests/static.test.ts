import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';

let webDist: string;

beforeAll(() => {
  webDist = mkdtempSync(path.join(tmpdir(), 'littleiran-web-'));
  mkdirSync(path.join(webDist, 'assets'));
  writeFileSync(path.join(webDist, 'index.html'), '<!doctype html><title>LittleIran</title><div id="root"></div>');
  writeFileSync(path.join(webDist, 'assets', 'app.js'), 'console.log("app");');
});

afterAll(() => {
  rmSync(webDist, { recursive: true, force: true });
});

// Deployment: Express serves the built web app next to the API
describe('Serving the built web app', () => {
  const app = () => createApp({ webDist });

  it('serves the home page and its files', async () => {
    const home = await request(app()).get('/');
    const script = await request(app()).get('/assets/app.js');

    expect(home.status).toBe(200);
    expect(home.type).toBe('text/html');
    expect(script.status).toBe(200);
    expect(script.type).toMatch(/javascript/);
  });

  it('opens the app for a page address, so reloading /login works', async () => {
    const res = await request(app()).get('/login');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain('<div id="root">');
  });

  it('keeps the reset link working with its token in the address', async () => {
    const res = await request(app()).get('/reset-password?token=abc123');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
  });

  it('still answers the API as JSON', async () => {
    const res = await request(app()).get('/api/health');

    expect(res.body).toEqual({ status: 'ok' });
  });

  it('does not answer an unknown API address with the web app', async () => {
    const res = await request(app()).get('/api/no-such-thing');

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('<div id="root">');
  });

  it('puts the security headers on the pages too', async () => {
    const res = await request(app()).get('/login');

    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('serves no pages when there is no built web app, as in development', async () => {
    const res = await request(createApp()).get('/login');

    expect(res.status).toBe(404);
  });
});
