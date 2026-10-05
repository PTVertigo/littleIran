import { createHash, randomBytes } from 'node:crypto';
import { pool } from './db';

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

// Only the hash is stored, so a leaked database cannot be used to hijack sessions
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await pool.query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
    userId,
    tokenHash,
    expiresAt,
  ]);
  return { token, expiresAt };
}
