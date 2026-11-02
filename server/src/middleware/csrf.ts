import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { CSRF_COOKIE, CSRF_HEADER, setCsrfCookie } from '../cookies';
import { logSecurity } from '../security-log';
import { generateToken } from '../tokens';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Double-submit cookie: another site can make the browser send our cookies along with a forged
// request, but it cannot read the CSRF cookie to copy its value into the header
export const csrfProtection: RequestHandler = (req, res, next) => {
  const cookieToken = req.cookies?.[CSRF_COOKIE];

  if (SAFE_METHODS.has(req.method)) {
    if (!cookieToken) setCsrfCookie(res, generateToken());
    next();
    return;
  }

  const headerToken = req.get(CSRF_HEADER);
  if (typeof cookieToken !== 'string' || !headerToken || !sameToken(cookieToken, headerToken)) {
    logSecurity('request refused for a missing or wrong CSRF token', { method: req.method, path: req.path });
    res.status(403).json({ error: 'This page is out of date. Refresh it and try again.' });
    return;
  }
  next();
};

function sameToken(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
