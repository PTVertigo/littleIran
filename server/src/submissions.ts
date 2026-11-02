import { pool } from './db';

// REQ-3.2.3 how many businesses and events a user has submitted, whatever their review status,
// shown on their public profile
export async function countSubmissions(userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    `SELECT (SELECT count(*) FROM businesses WHERE user_id = $1)::int
          + (SELECT count(*) FROM events WHERE user_id = $1)::int AS count`,
    [userId],
  );
  return rows[0].count;
}
