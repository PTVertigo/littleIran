import { Router } from 'express';
import { pool } from '../db';

export const categoriesRouter = Router();

// The categories a form, a filter or the forum offers: business, event or forum categories, never mixed
// (REQ-3.5.1 lists the forum ones)
categoriesRouter.get('/', async (req, res) => {
  const type = req.query.type;
  if (type !== 'business' && type !== 'event' && type !== 'forum') {
    res.status(400).json({ error: 'Choose a category type: business, event or forum.' });
    return;
  }
  const { rows } = await pool.query('SELECT id, name FROM categories WHERE type = $1 ORDER BY id', [type]);
  res.json({ categories: rows });
});
