import express, { type ErrorRequestHandler } from 'express';
import { usersRouter } from './routes/users';

// REQ-4.2 never leak stack traces or database details to the client
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body must be valid JSON.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/users', usersRouter);

  app.use(errorHandler);
  return app;
}
