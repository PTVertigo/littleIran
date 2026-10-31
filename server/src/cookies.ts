import type { CookieOptions, Response } from 'express';

export const SESSION_COOKIE = 'sid';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'X-CSRF-Token';

// REQ-4.1.4 cookies travel only over HTTPS; local development is the one place that runs plain http
const secure = process.env.NODE_ENV !== 'development';

// REQ-4.1.4 HttpOnly keeps the session token out of reach of page scripts
const sessionOptions: CookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, { ...sessionOptions, expires: expiresAt });
}

export function clearSessionCookie(res: Response) {
  // Drops the refreshed session cookie requireAuth already queued, so the response does not say both
  const queued = [res.getHeader('Set-Cookie') ?? []].flat().map(String);
  res.setHeader(
    'Set-Cookie',
    queued.filter((cookie) => !cookie.startsWith(`${SESSION_COOKIE}=`)),
  );
  res.clearCookie(SESSION_COOKIE, sessionOptions);
}

// Not HttpOnly: the web app reads it to echo the value back in the CSRF header
export function setCsrfCookie(res: Response, token: string) {
  res.cookie(CSRF_COOKIE, token, { secure, sameSite: 'strict', path: '/' });
}
