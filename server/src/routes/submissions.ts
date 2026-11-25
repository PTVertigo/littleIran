import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { isRecordId } from '../validation';

export const submissionsRouter = Router();
submissionsRouter.use(requireAuth);

// REQ-3.6.1 the member's own businesses and events with their status, newest first. A rejected one carries the
// reason the administrator gave (REQ-3.6.2). Only the member's own are ever returned.
submissionsRouter.get('/', async (req, res) => {
  const userId = req.auth!.user.id;
  const businesses = await pool.query(
    `SELECT b.id, b.name AS title, c.name AS category, b.status, b.rejection_reason AS "rejectionReason", b.created_at AS "submittedAt"
     FROM businesses b JOIN categories c ON c.id = b.category_id
     WHERE b.user_id = $1 ORDER BY b.created_at DESC, b.id DESC`,
    [userId],
  );
  const events = await pool.query(
    `SELECT e.id, e.title, c.name AS category, e.status, e.rejection_reason AS "rejectionReason", e.created_at AS "submittedAt",
            e.starts_at AS "startsAt"
     FROM events e JOIN categories c ON c.id = e.category_id
     WHERE e.user_id = $1 ORDER BY e.created_at DESC, e.id DESC`,
    [userId],
  );
  res.json({ businesses: businesses.rows, events: events.rows });
});

// REQ-3.6.3 the values of a rejected business, to fill the form it is resubmitted with. Another member's
// listing, a listing that is not rejected and an id that does not exist all answer 404 alike.
submissionsRouter.get('/businesses/:id', async (req, res) => {
  const id = String(req.params.id);
  const found = isRecordId(id)
    ? await pool.query(
        `SELECT name, category_id AS "categoryId", description, street, city, postal_code AS "postalCode", phone, email,
                coalesce(website, '') AS website, rejection_reason AS "rejectionReason"
         FROM businesses WHERE id = $1 AND user_id = $2 AND status = 'rejected'`,
        [id, req.auth!.user.id],
      )
    : { rows: [] };
  if (!found.rows[0]) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }
  const { rows: hours } = await pool.query(
    `SELECT day_of_week AS day, to_char(opens_at, 'HH24:MI') AS opens, to_char(closes_at, 'HH24:MI') AS closes
     FROM business_hours WHERE business_id = $1 ORDER BY day_of_week`,
    [id],
  );
  res.json({ business: { ...found.rows[0], hours } });
});

// REQ-3.6.3 the same for a rejected event. The date and times are Ontario wall-clock time.
submissionsRouter.get('/events/:id', async (req, res) => {
  const id = String(req.params.id);
  const found = isRecordId(id)
    ? await pool.query(
        `SELECT title, category_id AS "categoryId", description, location,
                to_char(starts_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD') AS date,
                to_char(starts_at AT TIME ZONE 'America/Toronto', 'HH24:MI') AS "startTime",
                coalesce(to_char(ends_at AT TIME ZONE 'America/Toronto', 'HH24:MI'), '') AS "endTime",
                organizer_name AS "organizerName", organizer_contact AS "organizerContact", rejection_reason AS "rejectionReason"
         FROM events WHERE id = $1 AND user_id = $2 AND status = 'rejected'`,
        [id, req.auth!.user.id],
      )
    : { rows: [] };
  if (!found.rows[0]) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }
  res.json({ event: found.rows[0] });
});
