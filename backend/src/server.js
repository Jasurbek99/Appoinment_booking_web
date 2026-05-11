import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { setupSockets } from './sockets/index.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { causesRouter } from './routes/causes.js';
import { appointmentsRouter } from './routes/appointments.js';
import { publicRouter } from './routes/public.js';
import { employeesRouter } from './routes/employees.js';
import { journalRouter } from './routes/journal.js';
import { statsRouter } from './routes/stats.js';
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
  app.use('/api/stats', statsRouter);

  app.use(errorMiddleware);
  return app;
}

// Build the http server with both Express and Socket.io attached.
export function createHttpServer() {
  const app = createApp();
  const httpServer = createServer(app);
  const io = setupSockets(httpServer);
  app.set('io', io);
  return { app, httpServer, io };
}

// Only start a listener when this file is executed directly (not when imported by tests).
// On Windows, import.meta.url uses three slashes (file:///D:/...). Build the same shape
// from process.argv[1] via pathToFileURL so the comparison is portable.
const isMainEntry = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainEntry) {
  const { httpServer } = createHttpServer();
  const server = httpServer.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
