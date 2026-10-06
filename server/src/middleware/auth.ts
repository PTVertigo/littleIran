import type { RequestHandler } from 'express';
import { touchSession } from '../sessions';

declare global {
  namespace Express {
    interface Request {
      auth?: { sessionId: string; user: Record<string, unknown> & { id: string } };
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const [scheme, token] = (req.get('Authorization') ?? '').split(' ');
  const session = scheme === 'Bearer' && token ? await touchSession(token) : null;

  if (!session) {
    res.status(401).json({ error: 'Please log in to continue.' });
    return;
  }
  req.auth = session;
  next();
};
