import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/db';
import { BCRYPT_ROUNDS } from '../src/users';

// Development logins. Safe to re-run: it resets the passwords and clears any lockout.
const DEV_USER = { email: 'test@test.com', password: 'Test123@', firstName: 'Test', lastName: 'User' };
// For the administrator pages (REQ-3.8)
const DEV_ADMIN = { email: 'admin@test.com', password: 'Admin123@', firstName: 'Admin', lastName: 'User' };

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

  await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (lower(email)) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'admin',
           status = 'active',
           failed_login_count = 0,
           first_failed_login_at = NULL,
           locked_until = NULL`,
    [DEV_ADMIN.email, await bcrypt.hash(DEV_ADMIN.password, BCRYPT_ROUNDS), DEV_ADMIN.firstName, DEV_ADMIN.lastName],
  );
  console.log(`seeded ${DEV_ADMIN.email} / ${DEV_ADMIN.password} (administrator)`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
