import { pool } from './db';
import { generateToken, hashToken } from './tokens';
import { PUBLIC_USER_COLUMNS } from './users';

const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000);

  await pool.query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
    userId,
    hashToken(token),
    expiresAt,
  ]);
  return { token, expiresAt };
}

// REQ-3.1.5: each use of a live session pushes its expiry out, so only idle sessions lapse
export async function touchSession(token: string) {
  const { rows } = await pool.query(
    `WITH touched AS (
       UPDATE sessions
       SET expires_at = now() + make_interval(secs => $2)
       WHERE token_hash = $1 AND expires_at > now()
       RETURNING id AS session_id, user_id
     )
     SELECT t.session_id AS "sessionId", ${PUBLIC_USER_COLUMNS}
     FROM touched t JOIN users ON users.id = t.user_id`,
    [hashToken(token), SESSION_LIFETIME_SECONDS],
  );
  if (!rows[0]) return null;

  const { sessionId, ...user } = rows[0];
  return { sessionId: sessionId as string, user };
}

export async function deleteSession(sessionId: string) {
  await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}
