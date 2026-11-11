import { Router } from 'express';
import { pool } from '../db';
import { FORUM_PAGE_SIZE, pageDetails, parsePage } from '../pagination';
import { isRecordId } from '../validation';

export const forumRouter = Router();

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
