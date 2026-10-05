import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /api/health', () => {
  it('reports the API is up', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
