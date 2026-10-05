import bcrypt from 'bcrypt';
import { Router } from 'express';
import { pool } from '../db';
import { isStrongPassword, isValidEmail } from '../validation';

const BCRYPT_ROUNDS = 12;
const NAME_MAX_LENGTH = 50;
const UNIQUE_VIOLATION = '23505';

export const usersRouter = Router();

// REQ-3.1.1 registration
usersRouter.post('/', async (req, res) => {
  const body = req.body ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';

  const errors: Record<string, string> = {};
  if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
  if (!isStrongPassword(password)) {
    errors.password =
      'Password must be 8-72 characters with an uppercase letter, a lowercase letter, a number and one of ! @ # $ % ^ & *.';
  }
  if (!firstName || firstName.length > NAME_MAX_LENGTH) errors.firstName = 'Enter your first name.';
  if (!lastName || lastName.length > NAME_MAX_LENGTH) errors.lastName = 'Enter your last name.';
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ errors });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name AS "firstName", last_name AS "lastName", role, created_at AS "createdAt"`,
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
