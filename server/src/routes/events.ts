import { Router } from 'express';
import { pool } from '../db';
import { isRecordId } from '../validation';

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

// REQ-3.4.2 one event in full, with its organizer. A pending or rejected event answers "not found",
// exactly like an id that does not exist, so nobody can tell that an unpublished event is there.
eventsRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const { rows } = isRecordId(id)
    ? await pool.query(
        `SELECT e.id, e.title, c.name AS category, e.description, e.location,
                e.starts_at AS "startsAt", e.ends_at AS "endsAt",
                e.organizer_name AS "organizerName", e.organizer_contact AS "organizerContact",
                coalesce(e.ends_at, e.starts_at) < now() AS past
         FROM events e JOIN categories c ON c.id = e.category_id
         WHERE e.id = $1 AND e.status = 'approved'`,
        [id],
      )
    : { rows: [] };
  if (!rows[0]) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }
  res.json({ event: rows[0] });
});
