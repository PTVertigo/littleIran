import { Router } from 'express';
import { validateBusiness } from '../business-validation';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { PAGE_SIZE, pageDetails, parsePage } from '../pagination';
import { escapeLike, parseCategoryFilter, parseSearch } from '../search';
import { isRecordId } from '../validation';

export const businessesRouter = Router();

// REQ-3.3.1 browse businesses: every approved listing, open to everyone because approval is what makes
// a listing public. Only the basic information is listed; pending and rejected listings never appear.
// REQ-3.7.1 ?search=... narrows it to businesses whose name or category contains every word typed.
// REQ-3.7.4 ?category=... narrows it to one category, by name. Both can be combined.
// REQ-3.7.7 ?page=... picks one page of 10; the answer also says how many businesses there are in all.
businessesRouter.get('/', async (req, res) => {
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
  const conditions = params.map((_, i) => `AND (b.name ILIKE $${i + 1} OR c.name ILIKE $${i + 1})`);
  if (filter.category) {
    params.push(filter.category);
    conditions.push(`AND lower(c.name) = lower($${params.length})`);
  }

  const where = `WHERE b.status = 'approved' ${conditions.join(' ')}`;
  const from = 'FROM businesses b JOIN categories c ON c.id = b.category_id';
  const count = await pool.query<{ total: number }>(`SELECT count(*)::int AS total ${from} ${where}`, params);

  const { rows } = await pool.query(
    `SELECT b.id, b.name, c.name AS category, b.city, b.description
     ${from} ${where}
     ORDER BY lower(b.name), b.id
     LIMIT ${PAGE_SIZE} OFFSET $${params.length + 1}`,
    [...params, (paging.page - 1) * PAGE_SIZE],
  );
  res.json({ businesses: rows, ...pageDetails(paging.page, count.rows[0].total) });
});

// REQ-3.3 create a business listing. It starts as pending and belongs to the member who submitted it;
// it only appears in the directory once an administrator approves it (REQ-3.8.2).
businessesRouter.post('/', requireAuth, async (req, res) => {
  const { errors, value } = validateBusiness(req.body);
  if (!value) {
    res.status(400).json({ errors });
    return;
  }

  const category = await pool.query("SELECT 1 FROM categories WHERE id = $1 AND type = 'business'", [value.categoryId]);
  if (!category.rowCount) {
    res.status(400).json({ errors: { categoryId: 'Choose a category.' } });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO businesses
         (user_id, category_id, name, description, street, city, postal_code, phone, email, website)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        req.auth!.user.id,
        value.categoryId,
        value.name,
        value.description,
        value.street,
        value.city,
        value.postalCode,
        value.phone,
        value.email,
        value.website,
      ],
    );
    for (const { day, opens, closes } of value.hours) {
      await client.query(
        'INSERT INTO business_hours (business_id, day_of_week, opens_at, closes_at) VALUES ($1, $2, $3, $4)',
        [rows[0].id, day, opens, closes],
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ business: { id: rows[0].id, name: value.name, status: 'pending' } });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
