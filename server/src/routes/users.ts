import bcrypt from 'bcrypt';
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { BCRYPT_ROUNDS, PUBLIC_USER_COLUMNS } from '../users';
import { isStrongPassword, isValidEmail, PASSWORD_RULES_MESSAGE, validateNames } from '../validation';

const UNIQUE_VIOLATION = '23505';

export const usersRouter = Router();

// REQ-3.2.1 view own profile: email, first and last name, registration date, role
usersRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.auth!.user });
});

// REQ-3.2.2 update own profile. Only the two names can change, whatever else the body carries.
usersRouter.put('/me', requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';

  const errors = validateNames(firstName, lastName);
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ errors });
    return;
  }

  const { rows } = await pool.query(
    `UPDATE users SET first_name = $2, last_name = $3 WHERE id = $1 RETURNING ${PUBLIC_USER_COLUMNS}`,
    [req.auth!.user.id, firstName, lastName],
  );
  res.json({ user: rows[0] });
});

// REQ-3.1.1 registration
usersRouter.post('/', async (req, res) => {
  const body = req.body ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';

  const errors: Record<string, string> = validateNames(firstName, lastName);
  if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
  if (!isStrongPassword(password)) {
    errors.password = PASSWORD_RULES_MESSAGE;
  }
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ errors });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PUBLIC_USER_COLUMNS}`,
      [email, passwordHash, firstName, lastName],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // REQ-3.1.2 email must not already be registered
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      res.status(409).json({ errors: { email: 'That email is already registered.' } });
      return;
    }
    throw err;
  }
});
