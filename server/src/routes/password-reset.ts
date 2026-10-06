import bcrypt from 'bcrypt';
import { Router } from 'express';
import { pool } from '../db';
import { sendPasswordResetEmail } from '../email';
import { generateToken, hashToken } from '../tokens';
import { BCRYPT_ROUNDS } from '../users';
import { isStrongPassword, isValidEmail } from '../validation';

const RESET_LINK_BASE = 'littleiran://reset-password';
const RESET_TOKEN_MINUTES = 60;

export const passwordResetRouter = Router();

// REQ-3.1.6 step 1: the answer is the same whether or not the email is registered
passwordResetRouter.post('/forgot-password', async (req, res) => {
  const body = req.body ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!isValidEmail(email)) {
    res.status(400).json({ errors: { email: 'Enter a valid email address.' } });
    return;
  }

  const token = generateToken();
  const { rowCount } = await pool.query(
    `UPDATE users
     SET reset_token_hash = $2, reset_token_expires_at = now() + make_interval(mins => $3)
     WHERE lower(email) = $1`,
    [email, hashToken(token), RESET_TOKEN_MINUTES],
  );
  if (rowCount) {
    await sendPasswordResetEmail(email, `${RESET_LINK_BASE}?token=${token}`);
  }

  res.status(202).json({ message: 'If that email is registered, a reset link is on its way.' });
});

// REQ-3.1.6 step 2: the link's token plus a new password
passwordResetRouter.post('/reset-password', async (req, res) => {
  const body = req.body ?? {};
  const token = typeof body.token === 'string' ? body.token : '';
  const password = typeof body.password === 'string' ? body.password : '';

  // Checked before touching the token so a weak password does not use up the link
  if (!isStrongPassword(password)) {
    res.status(400).json({
      errors: {
        password:
          'Password must be 8-72 characters with an uppercase letter, a lowercase letter, a number and one of ! @ # $ % ^ & *.',
      },
    });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { rows } = await pool.query<{ id: string }>(
    `UPDATE users
     SET password_hash = $2, reset_token_hash = NULL, reset_token_expires_at = NULL,
         failed_login_count = 0, first_failed_login_at = NULL, locked_until = NULL
     WHERE reset_token_hash = $1 AND reset_token_expires_at > now()
     RETURNING id`,
    [hashToken(token), passwordHash],
  );
  if (!rows[0]) {
    res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    return;
  }

  // Whoever knew the old password must not stay logged in
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [rows[0].id]);
  res.json({ message: 'Password updated. You can now log in.' });
});
