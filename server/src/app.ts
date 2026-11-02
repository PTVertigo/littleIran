import cookieParser from 'cookie-parser';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import { csrfProtection } from './middleware/csrf';
import { securityHeaders } from './middleware/security-headers';
import { authRouter } from './routes/auth';
import { passwordResetRouter } from './routes/password-reset';
import { usersRouter } from './routes/users';

// REQ-4.2 never leak stack traces or database details to the client
const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body must be valid JSON.' });
    return;
  }
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'That request is too large.' });
    return;
  }
  // Other mistakes by the client, such as a malformed address, are not server failures
  const status = err.status ?? err.statusCode;
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: 'That request could not be understood.' });
    return;
  }
  // The stack only: a database error object also carries the values of the failing query
  console.error('Unhandled error:', err instanceof Error ? err.stack : String(err));
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};

// webDist is the built web app. It is only served in production, where Express is the one web service
// for both the API and the pages, which keeps the session cookies same-origin.
export function createApp({ webDist }: { webDist?: string } = {}) {
  const app = express();
  // REQ-4.2 do not advertise the framework
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(cookieParser());
  app.use('/api', csrfProtection);
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/users', usersRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/auth', passwordResetRouter);

  if (webDist) {
    app.use(express.static(webDist));
    // Reloading or sharing a page address such as /login must still open the app, but a wrong API address is not a page
    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  // An unknown API address gets JSON like every other API answer, not the framework's HTML page
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  app.use(errorHandler);
  return app;
}
