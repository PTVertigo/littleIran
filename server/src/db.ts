import { Pool } from 'pg';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// REQ-4.2 the database can drop an idle connection. Without a listener, Node treats that
// error as unhandled and stops the whole server; with one, the pool just opens a new connection.
pool.on('error', (err) => {
  console.error('Database connection error:', err.message);
});
