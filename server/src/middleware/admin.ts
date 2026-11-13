import type { RequestHandler } from 'express';
import { logSecurity } from '../security-log';
import { requireAuth } from './auth';

// REQ-4.1.4 / API-005 administrator endpoints: 401 without a session, 403 for a member who is not an administrator
export const requireAdmin: RequestHandler[] = [
  requireAuth,
  (req, res, next) => {
    if (req.auth?.user.role !== 'admin') {
      logSecurity('forbidden request', { userId: req.auth?.user.id, method: req.method, path: req.originalUrl.split('?')[0] });
      res.status(403).json({ error: 'You do not have permission to do that.' });
      return;
    }
    next();
  },
];
