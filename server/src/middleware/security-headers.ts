import type { RequestHandler } from 'express';

// REQ-4.1 browser-side defences, set on every response. They also apply to the built web app,
// which Express serves in production. The app has no inline scripts or styles, so 'self' is enough.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  // The reset link carries its token in the address, so it must never travel in a Referer header
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // Account and session responses must not be kept by browsers or proxies
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  next();
};
