import { Router } from 'express';
import { pool } from '../db';

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
