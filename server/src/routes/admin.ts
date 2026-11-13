import { Router } from 'express';
import { pool } from '../db';
import { requireAdmin } from '../middleware/admin';
import { isRecordId } from '../validation';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

export const REASON_MAX = 500;

// REQ-3.8.1 everything waiting for a decision, oldest first so nothing is left behind
adminRouter.get('/submissions', async (_req, res) => {
  const businesses = await pool.query(
    `SELECT b.id, b.name AS title, c.name AS category, b.description, b.city AS location, b.created_at AS "submittedAt",
            u.id AS "submitterId", u.first_name || ' ' || u.last_name AS "submitterName", u.email AS "submitterEmail"
     FROM businesses b JOIN categories c ON c.id = b.category_id LEFT JOIN users u ON u.id = b.user_id
     WHERE b.status = 'pending' ORDER BY b.created_at, b.id`,
  );
  const events = await pool.query(
    `SELECT e.id, e.title, c.name AS category, e.description, e.location, e.starts_at AS "startsAt", e.created_at AS "submittedAt",
            u.id AS "submitterId", u.first_name || ' ' || u.last_name AS "submitterName", u.email AS "submitterEmail"
     FROM events e JOIN categories c ON c.id = e.category_id LEFT JOIN users u ON u.id = e.user_id
     WHERE e.status = 'pending' ORDER BY e.created_at, e.id`,
  );
  res.json({ businesses: businesses.rows, events: events.rows });
});

// The reason a submitter is shown (REQ-3.6.2). Required, kept as typed, escaped where it is shown.
export function validateReason(body: unknown): { errors: Record<string, string>; value?: string } {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).reason : undefined;
  const reason = typeof raw === 'string' ? raw.trim() : '';
  if (!reason) return { errors: { reason: 'Give the reason for the rejection.' } };
  if (reason.length > REASON_MAX) return { errors: { reason: `The reason can be at most ${REASON_MAX} characters.` } };
  if (reason.includes('\0')) return { errors: { reason: 'The reason contains characters that are not allowed.' } };
  return { errors: {}, value: reason };
}

// Only a pending submission can be decided; the table name is one of two constants, never user input
function decision(table: 'businesses' | 'events', label: string, action: 'approve' | 'reject') {
  adminRouter.post(`/${table}/:id/${action}`, async (req, res) => {
    const id = String(req.params.id);
    let reason: string | null = null;
    if (action === 'reject') {
      const checked = validateReason(req.body);
      if (!checked.value) {
        res.status(400).json({ errors: checked.errors });
        return;
      }
      reason = checked.value;
    }
    if (!isRecordId(id)) {
      res.status(404).json({ error: `${label} not found.` });
      return;
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    const { rows } = await pool.query(
      `UPDATE ${table} SET status = $2, rejection_reason = $3 WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id, status, reason],
    );
    if (rows[0]) {
      res.json({ [label.toLowerCase()]: { id: rows[0].id, status } });
      return;
    }
    const exists = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
    if (exists.rowCount) res.status(409).json({ error: `This ${label.toLowerCase()} has already been reviewed.` });
    else res.status(404).json({ error: `${label} not found.` });
  });
}

// REQ-3.8.2 / 3.8.3 businesses, REQ-3.8.4 / 3.8.5 events
decision('businesses', 'Business', 'approve');
decision('businesses', 'Business', 'reject');
decision('events', 'Event', 'approve');
decision('events', 'Event', 'reject');
