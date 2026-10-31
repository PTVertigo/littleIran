import { pool } from './db';

// REQ-3.1.9 / 4.1.6: 5 failed logins within 15 minutes lock the account for 30 minutes
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MINUTES = 15;
const LOCK_MINUTES = 30;

// Returns the lock expiry if this failure locked the account, otherwise null.
// The row lock keeps simultaneous guesses from slipping past the counter.
export async function recordFailedLogin(userId: string): Promise<Date | null> {
  const { rows } = await pool.query<{ lockedNow: boolean; lockedUntil: Date | null }>(
    `UPDATE users u
     SET failed_login_count = c.n,
         first_failed_login_at = c.first_at,
         locked_until = CASE WHEN c.n >= $2 THEN now() + make_interval(mins => $4) ELSE u.locked_until END
     FROM (
       SELECT id,
              CASE WHEN first_failed_login_at IS NULL
                     OR first_failed_login_at < now() - make_interval(mins => $3)
                   THEN 1 ELSE failed_login_count + 1 END AS n,
              CASE WHEN first_failed_login_at IS NULL
                     OR first_failed_login_at < now() - make_interval(mins => $3)
                   THEN now() ELSE first_failed_login_at END AS first_at
       FROM users WHERE id = $1 FOR UPDATE
     ) c
     WHERE u.id = c.id
     RETURNING c.n >= $2 AS "lockedNow", u.locked_until AS "lockedUntil"`,
    [userId, MAX_FAILED_ATTEMPTS, ATTEMPT_WINDOW_MINUTES, LOCK_MINUTES],
  );

  if (!rows[0].lockedNow) return null;
  console.warn('security: account locked after repeated failed logins', { userId });
  return rows[0].lockedUntil;
}
