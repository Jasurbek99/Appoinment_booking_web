import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
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

  app.use(errorMiddleware);
  return app;
}

// Only start a listener when this file is executed directly (not when imported by tests).
const isMainEntry = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
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
