import { Router } from 'express';
import { pool } from '../db';
import { validateForumPost } from '../forum-validation';
import { requireAuth } from '../middleware/auth';
import { FORUM_PAGE_SIZE, pageDetails, parsePage } from '../pagination';
import { escapeLike, parseCategoryFilter, parseSearch } from '../search';
import { isRecordId } from '../validation';

export const forumRouter = Router();

// REQ-3.5 create a forum post. Members only. Posts are published at once, with the moderation status
// "approved"; a flag or an administrator changes that later (REQ-3.8.9, REQ-3.8.10).
forumRouter.post('/posts', requireAuth, async (req, res) => {
  const { errors, value } = validateForumPost(req.body);
  if (!value) {
    res.status(400).json({ errors });
    return;
  }

  // Only a forum category can hold a post; the database enforces it too
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO forum_posts (user_id, category_id, title, content)
     SELECT $1, c.id, $3, $4 FROM categories c WHERE c.id = $2 AND c.type = 'forum'
     RETURNING id`,
    [req.auth!.user.id, value.categoryId, value.title, value.content],
  );
  if (!rows[0]) {
    res.status(400).json({ errors: { categoryId: 'Choose a category.' } });
    return;
  }
  res.status(201).json({ post: { id: rows[0].id, title: value.title, categoryId: value.categoryId, status: 'approved' } });
});

// REQ-3.7.3 search the posts of every forum category: ?search=... keeps posts whose title or content contains
// every word typed. REQ-3.7.6 ?category=... keeps one category, by name; the two combine. Each result names its
// category. Newest first, 15 to a page, and hidden posts never appear (as in REQ-3.5.2).
forumRouter.get('/posts', async (req, res) => {
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
  const conditions = params.map((_, i) => `AND (p.title ILIKE $${i + 1} OR p.content ILIKE $${i + 1})`);
  if (filter.category) {
    params.push(filter.category);
    conditions.push(`AND lower(c.name) = lower($${params.length})`);
  }

  const where = `WHERE p.status IN ('approved', 'flagged') ${conditions.join(' ')}`;
  const from = 'FROM forum_posts p JOIN categories c ON c.id = p.category_id LEFT JOIN users u ON u.id = p.user_id';
  const count = await pool.query<{ total: number }>(`SELECT count(*)::int AS total ${from} ${where}`, params);

  const { rows } = await pool.query(
    `SELECT p.id, p.title, left(p.content, 200) AS excerpt, p.created_at AS "createdAt", p.views,
            c.id AS "categoryId", c.name AS category,
            u.id AS "authorId", u.first_name || ' ' || u.last_name AS "authorName"
     ${from} ${where}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ${FORUM_PAGE_SIZE} OFFSET $${params.length + 1}`,
    [...params, (paging.page - 1) * FORUM_PAGE_SIZE],
  );
  res.json({ posts: rows, ...pageDetails(paging.page, count.rows[0].total, FORUM_PAGE_SIZE) });
});

// REQ-3.5.2 the posts of one forum category, newest first, open to everyone. REQ-3.7.9 shows 15 to a page.
// A flagged post stays visible until an administrator acts on it; a hidden post (REQ-3.8.10) does not.
// An author whose account was deleted is shown without a name or a profile link (REQ-3.2.4).
forumRouter.get('/categories/:id/posts', async (req, res) => {
  const id = String(req.params.id);
  const category = isRecordId(id)
    ? await pool.query<{ id: string; name: string }>("SELECT id, name FROM categories WHERE id = $1 AND type = 'forum'", [id])
    : { rows: [] };
  if (!category.rows[0]) {
    res.status(404).json({ error: 'Forum category not found.' });
    return;
  }

  const paging = parsePage(req.query.page);
  if ('error' in paging) {
    res.status(400).json({ error: paging.error });
    return;
  }

  const visible = "p.category_id = $1 AND p.status IN ('approved', 'flagged')";
  const count = await pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM forum_posts p WHERE ${visible}`, [id]);

  const { rows } = await pool.query(
    `SELECT p.id, p.title, left(p.content, 200) AS excerpt, p.created_at AS "createdAt", p.views,
            u.id AS "authorId", u.first_name || ' ' || u.last_name AS "authorName"
     FROM forum_posts p LEFT JOIN users u ON u.id = p.user_id
     WHERE ${visible}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT ${FORUM_PAGE_SIZE} OFFSET $2`,
    [id, (paging.page - 1) * FORUM_PAGE_SIZE],
  );
  res.json({ category: category.rows[0], posts: rows, ...pageDetails(paging.page, count.rows[0].total, FORUM_PAGE_SIZE) });
});
