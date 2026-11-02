import type { RequestHandler } from 'express';
import { SESSION_COOKIE, setSessionCookie } from '../cookies';
import { logSecurity } from '../security-log';
import { touchSession } from '../sessions';

declare global {
  namespace Express {
    interface Request {
      auth?: { sessionId: string; user: Record<string, unknown> & { id: string } };
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = typeof token === 'string' && token ? await touchSession(token) : null;

  if (!session) {
    // originalUrl without its query string, which can carry a token
    logSecurity('unauthorized request', { method: req.method, path: req.originalUrl.split('?')[0] });
    res.status(401).json({ error: 'Please log in to continue.' });
    return;
  }
  // The cookie's expiry follows the session's, so an active browser stays logged in
  setSessionCookie(res, token, session.expiresAt);
  req.auth = { sessionId: session.sessionId, user: session.user };
  next();
};
