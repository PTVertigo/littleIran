import bcrypt from 'bcrypt';
import { Router } from 'express';
import { pool } from '../db';
import { createSession } from '../sessions';
import { BCRYPT_ROUNDS, PUBLIC_USER_COLUMNS } from '../users';

// Compared against when the email is unknown so response time does not reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export const authRouter = Router();

// REQ-3.1.4 login, REQ-3.1.5 session
authRouter.post('/login', async (req, res) => {
  const body = req.body ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const { rows } = await pool.query(
    `SELECT ${PUBLIC_USER_COLUMNS}, password_hash FROM users WHERE lower(email) = $1`,
    [email],
  );
  const { password_hash: passwordHash, ...user } = rows[0] ?? {};

  const passwordMatches = await bcrypt.compare(password, passwordHash ?? DUMMY_HASH);
  if (!user.id || !passwordMatches) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const session = await createSession(user.id);
  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  res.json({ token: session.token, expiresAt: session.expiresAt, user });
});
