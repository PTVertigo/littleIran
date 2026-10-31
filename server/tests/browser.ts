import type { Express } from 'express';
import request from 'supertest';
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from '../src/cookies';

export const CSRF_TOKEN = 'c'.repeat(64);

// Sends requests the way the web app does: the CSRF cookie with its matching header, plus the
// session cookie when there is one
export function browser(app: Express, session?: string) {
  const cookie = [`${CSRF_COOKIE}=${CSRF_TOKEN}`, session && `${SESSION_COOKIE}=${session}`]
    .filter(Boolean)
    .join('; ');
  return {
    get: (path: string) => request(app).get(path).set('Cookie', cookie),
    post: (path: string) =>
      request(app).post(path).set('Cookie', cookie).set(CSRF_HEADER, CSRF_TOKEN),
  };
}

// The response's Set-Cookie header for one cookie, e.g. "sid=abc; Path=/; HttpOnly"
export function setCookie(res: request.Response, name: string) {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith(`${name}=`));
}

export function sessionToken(res: request.Response) {
  return setCookie(res, SESSION_COOKIE)?.split(';')[0].split('=')[1];
}
