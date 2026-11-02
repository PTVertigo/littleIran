import { Router } from 'express';
import { pool } from '../db';
import { isRecordId } from '../validation';

export const businessesRouter = Router();

// REQ-3.3.1 browse businesses: every approved listing, open to everyone because approval is what makes
// a listing public. Only the basic information is listed; pending and rejected listings never appear.
businessesRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id, b.name, c.name AS category, b.city, b.description
     FROM businesses b JOIN categories c ON c.id = b.category_id
     WHERE b.status = 'approved'
     ORDER BY lower(b.name), b.id`,
  );
  res.json({ businesses: rows });
});

// REQ-3.3.2 one business in full. A pending or rejected listing answers "not found", exactly like an
// id that does not exist, so nobody can tell that an unpublished listing is there.
businessesRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const { rows } = isRecordId(id)
    ? await pool.query(
        `SELECT b.id, b.name, c.name AS category, b.description, b.street, b.city,
                b.postal_code AS "postalCode", b.phone, b.email, b.website
         FROM businesses b JOIN categories c ON c.id = b.category_id
         WHERE b.id = $1 AND b.status = 'approved'`,
        [id],
      )
    : { rows: [] };
  if (!rows[0]) {
    res.status(404).json({ error: 'Business not found.' });
    return;
  }

  // Only the days it is open have a row. 1 is Monday and 7 is Sunday.
  const { rows: hours } = await pool.query(
    `SELECT day_of_week AS day, to_char(opens_at, 'HH24:MI') AS opens, to_char(closes_at, 'HH24:MI') AS closes
     FROM business_hours WHERE business_id = $1 ORDER BY day_of_week`,
    [id],
  );
  res.json({ business: { ...rows[0], hours } });
});
