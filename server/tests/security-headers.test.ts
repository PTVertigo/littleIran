import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

// SEC-001 / SEC-002 follow-up: findings from the OWASP ZAP baseline scan
describe('Security headers', () => {
  it('stops browsers from guessing content types and from framing the app', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('only allows scripts and styles from the app\'s own origin', async () => {
    const csp = (await request(app).get('/api/health')).headers['content-security-policy'];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('keeps the reset-link token out of Referer headers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('does not say what framework is behind the API', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('tells browsers and proxies not to keep API responses', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sets the headers on error responses too', async () => {
    const res = await request(app).post('/api/users').set('Content-Type', 'application/json').send('{bad');

    expect(res.status).toBe(403);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
