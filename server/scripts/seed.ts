import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/db';
import { BCRYPT_ROUNDS } from '../src/users';

// Development login. Safe to re-run: it resets the password and clears any lockout.
const DEV_USER = { email: 'test@test.com', password: 'Test123@', firstName: 'Test', lastName: 'User' };

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  const passwordHash = await bcrypt.hash(DEV_USER.password, BCRYPT_ROUNDS);
  await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lower(email)) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           failed_login_count = 0,
           first_failed_login_at = NULL,
           locked_until = NULL`,
    [DEV_USER.email, passwordHash, DEV_USER.firstName, DEV_USER.lastName],
  );
  console.log(`seeded ${DEV_USER.email} / ${DEV_USER.password}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
