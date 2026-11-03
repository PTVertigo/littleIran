import { Router } from 'express';
import { pool } from '../db';

export const categoriesRouter = Router();

// The categories a form or a filter offers: business categories or event categories, never mixed
categoriesRouter.get('/', async (req, res) => {
  const type = req.query.type;
  if (type !== 'business' && type !== 'event') {
    res.status(400).json({ error: 'Choose a category type: business or event.' });
    return;
  }
  const { rows } = await pool.query('SELECT id, name FROM categories WHERE type = $1 ORDER BY id', [type]);
  res.json({ categories: rows });
});
