import bcrypt from 'bcrypt';
import { Router } from 'express';
import { pool } from '../db';
import { recordFailedLogin } from '../lockout';
import { requireAuth } from '../middleware/auth';
import { createSession, deleteSession } from '../sessions';
import { BCRYPT_ROUNDS, PUBLIC_USER_COLUMNS } from '../users';

// Compared against when the email is unknown so response time does not reveal which emails exist
const LOCKED_MESSAGE = 'Too many failed attempts. Try again in 30 minutes.';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export const authRouter = Router();

// REQ-3.1.4 login, REQ-3.1.5 session
authRouter.post('/login', async (req, res) => {
  const body = req.body ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const { rows } = await pool.query(
    `SELECT ${PUBLIC_USER_COLUMNS}, password_hash, locked_until FROM users WHERE lower(email) = $1`,
    [email],
  );
  const { password_hash: passwordHash, locked_until: lockedUntil, ...user } = rows[0] ?? {};

  if (lockedUntil && lockedUntil > new Date()) {
    console.warn('security: login refused for locked account', { userId: user.id });
    res.status(423).json({ error: LOCKED_MESSAGE });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, passwordHash ?? DUMMY_HASH);
  if (!user.id || !passwordMatches) {
    if (user.id && (await recordFailedLogin(user.id))) {
      res.status(423).json({ error: LOCKED_MESSAGE });
      return;
    }
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const session = await createSession(user.id);
  await pool.query(
    `UPDATE users
     SET last_login_at = now(), failed_login_count = 0, first_failed_login_at = NULL, locked_until = NULL
     WHERE id = $1`,
    [user.id],
  );
  res.json({ token: session.token, expiresAt: session.expiresAt, user });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.auth!.user });
});

// REQ-3.1.8 logout
authRouter.post('/logout', requireAuth, async (req, res) => {
  await deleteSession(req.auth!.sessionId);
  res.status(204).end();
});
