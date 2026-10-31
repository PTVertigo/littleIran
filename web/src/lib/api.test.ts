import { mockFetch } from '../test/render';
import { ApiError, apiRequest } from './api';

afterEach(() => {
  document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('apiRequest', () => {
  it('echoes the CSRF cookie in a header on state-changing requests', async () => {
    document.cookie = 'csrf_token=abc123';
    const fetchMock = mockFetch({ status: 200, body: {} });

    await apiRequest('/api/auth/login', { method: 'POST', body: { email: 'a@b.co' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'abc123' });
    expect(init.body).toBe('{"email":"a@b.co"}');
  });

  it('sends no CSRF header on reads', async () => {
    document.cookie = 'csrf_token=abc123';
    const fetchMock = mockFetch({ status: 200, body: {} });

    await apiRequest('/api/auth/me');

    expect(fetchMock.mock.calls[0][1].headers).toEqual({});
  });

  it('turns field errors into an ApiError with the first one as its message', async () => {
    mockFetch({ status: 400, body: { errors: { email: 'Enter a valid email address.' } } });

    const error = (await apiRequest('/api/users', { method: 'POST', body: {} }).catch((e) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Enter a valid email address.');
    expect(error.fieldErrors).toEqual({ email: 'Enter a valid email address.' });
  });

  it('explains an unreachable server in plain words', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const error = (await apiRequest('/api/auth/me').catch((e) => e)) as ApiError;

    expect(error.status).toBe(0);
    expect(error.message).toMatch(/cannot reach the server/i);
  });

  it('returns nothing for 204 No Content', async () => {
    mockFetch({ status: 204 });
    await expect(apiRequest('/api/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});
