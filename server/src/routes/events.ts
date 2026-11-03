import { Router } from 'express';
import { validateEvent } from '../event-validation';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { PAGE_SIZE, pageDetails, parsePage } from '../pagination';
import { escapeLike, parseCategoryFilter, parseSearch } from '../search';
import { isRecordId } from '../validation';

export const eventsRouter = Router();

// REQ-3.4.1 browse events: every approved event, open to everyone because approval is what makes an event
// public. Events that have not finished come first, soonest first; finished ones follow, latest first.
// Pending and rejected events never appear.
// REQ-3.7.2 ?search=... narrows it to events whose name or category contains every word typed.
// REQ-3.7.5 ?category=... narrows it to one category, by name. Both can be combined.
// REQ-3.7.8 ?page=... picks one page of 10; the answer also says how many events there are in all.
eventsRouter.get('/', async (req, res) => {
  const search = parseSearch(req.query.search);
  if ('error' in search) {
    res.status(400).json({ error: search.error });
    return;
  }

  const filter = parseCategoryFilter(req.query.category);
  if ('error' in filter) {
    res.status(400).json({ error: filter.error });
    return;
  }

  const paging = parsePage(req.query.page);
  if ('error' in paging) {
    res.status(400).json({ error: paging.error });
    return;
  }

  // One condition per word, built only from parameter numbers. The words themselves are parameters.
  const params: string[] = search.terms.map((term) => `%${escapeLike(term)}%`);
  const conditions = params.map((_, i) => `AND (e.title ILIKE $${i + 1} OR c.name ILIKE $${i + 1})`);
  if (filter.category) {
    params.push(filter.category);
    conditions.push(`AND lower(c.name) = lower($${params.length})`);
  }

  const where = `WHERE e.status = 'approved' ${conditions.join(' ')}`;
  const from = 'FROM events e JOIN categories c ON c.id = e.category_id';
  const count = await pool.query<{ total: number }>(`SELECT count(*)::int AS total ${from} ${where}`, params);

  const { rows } = await pool.query(
    `SELECT e.id, e.title, c.name AS category, e.starts_at AS "startsAt", e.location, e.description,
            coalesce(e.ends_at, e.starts_at) < now() AS past
     ${from} ${where}
     ORDER BY past,
              CASE WHEN NOT coalesce(e.ends_at, e.starts_at) < now() THEN e.starts_at END ASC,
              e.starts_at DESC,
              e.id
     LIMIT ${PAGE_SIZE} OFFSET $${params.length + 1}`,
    [...params, (paging.page - 1) * PAGE_SIZE],
  );
  res.json({ events: rows, ...pageDetails(paging.page, count.rows[0].total) });
});

// REQ-3.4 create an event. It starts as pending and belongs to the member who submitted it; it only
// appears on the events page once an administrator approves it (REQ-3.8.2).
eventsRouter.post('/', requireAuth, async (req, res) => {
  const { errors, value } = validateEvent(req.body);
  if (!value) {
    res.status(400).json({ errors });
    return;
  }

  const category = await pool.query("SELECT 1 FROM categories WHERE id = $1 AND type = 'event'", [value.categoryId]);
  if (!category.rowCount) {
    res.status(400).json({ errors: { categoryId: 'Choose a category.' } });
    return;
  }

  // The date and times are Ontario wall-clock time; the database turns them into instants
  const { rows } = await pool.query<{ id: string }>(
    `WITH times AS (
       SELECT ($1::date + $2::time) AT TIME ZONE 'America/Toronto' AS starts_at,
              CASE WHEN $3::time IS NULL THEN NULL ELSE ($1::date + $3::time) AT TIME ZONE 'America/Toronto' END AS ends_at
     )
     INSERT INTO events (user_id, category_id, title, description, location, starts_at, ends_at, organizer_name, organizer_contact)
     SELECT $4, $5, $6, $7, $8, starts_at, ends_at, $9, $10 FROM times
     WHERE starts_at > now() AND starts_at < now() + interval '3 years'
     RETURNING id`,
    [
      value.date,
      value.startTime,
      value.endTime,
      req.auth!.user.id,
      value.categoryId,
      value.title,
      value.description,
      value.location,
      value.organizerName,
      value.organizerContact,
    ],
  );
  if (!rows[0]) {
    // Not in the future, or too far ahead to be a real plan
    res.status(400).json({ errors: { date: 'Choose a date and time that have not passed yet, within the next three years.' } });
    return;
  }
  res.status(201).json({ event: { id: rows[0].id, title: value.title, status: 'pending' } });
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
