import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { causesRouter } from './routes/causes.js';
import { appointmentsRouter } from './routes/appointments.js';
import { publicRouter } from './routes/public.js';
import { employeesRouter } from './routes/employees.js';
import { journalRouter } from './routes/journal.js';
import { errorMiddleware } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(cookieParser());
  app.use(cors({ credentials: true, origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, env: config.env });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/causes', causesRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api/journal', journalRouter);

  app.use(errorMiddleware);
  return app;
}

// Only start a listener when this file is executed directly (not when imported by tests).
// On Windows, import.meta.url uses three slashes (file:///D:/...). Build the same shape
// from process.argv[1] via pathToFileURL so the comparison is portable.
const isMainEntry = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainEntry) {
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
