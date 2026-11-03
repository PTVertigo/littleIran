import { Router } from 'express';
import { pool } from '../db';

export const eventsRouter = Router();

// REQ-3.4.1 browse events: every approved event, open to everyone because approval is what makes an event
// public. Events that have not finished come first, soonest first; finished ones follow, latest first.
// Pending and rejected events never appear.
eventsRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.title, c.name AS category, e.starts_at AS "startsAt", e.location, e.description,
            coalesce(e.ends_at, e.starts_at) < now() AS past
     FROM events e JOIN categories c ON c.id = e.category_id
     WHERE e.status = 'approved'
     ORDER BY past,
              CASE WHEN NOT coalesce(e.ends_at, e.starts_at) < now() THEN e.starts_at END ASC,
              e.starts_at DESC,
              e.id`,
  );
  res.json({ events: rows });
});
