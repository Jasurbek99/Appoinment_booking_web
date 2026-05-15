import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { config } from './config.js';
import { logger } from './lib/logger.js';
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
import { apiLimiter } from './middleware/rateLimit.js';
import { getPool, closePool } from './db/pool.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Required behind nginx so req.ip, secure cookies, and rate-limit keying
  // see the real client address from X-Forwarded-For instead of nginx.
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  // Helmet defaults minus CSP and CORP — both belong on the HTML response
  // served by nginx, not on JSON API responses where they cause more harm
  // than good (broken cross-origin font/image fetching from the SPA).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  // Structured request logger. Skips /api/health to keep liveness probes out of the log.
  if (config.env !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      })
    );
  }

  app.use(cookieParser());

  // Empty CORS_ORIGIN means same-origin deployment behind nginx — skip the
  // middleware entirely so no preflight logic runs and no Access-Control-*
  // headers leak. Otherwise allow only the configured origins.
  if (config.corsOrigin.length > 0) {
    app.use(cors({ credentials: true, origin: config.corsOrigin }));
  }

  app.use(express.json({ limit: config.bodyLimit }));

  // Liveness + readiness in one. Pings the DB so an orchestrator knows when
  // the app can actually serve traffic, not just when the process is alive.
  // Mounted under /api so external probes reach it through the nginx proxy.
  app.get('/api/health', async (_req, res) => {
    try {
      const pool = await getPool();
      await pool.request().query('SELECT 1');
      res.json({ ok: true, env: config.env, db: 'up' });
    } catch (err) {
      logger.warn({ err }, 'health check db failure');
      res.status(503).json({ ok: false, env: config.env, db: 'down' });
    }
  });

  app.use('/api', apiLimiter);
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
  const { httpServer, io } = createHttpServer();
  const server = httpServer.listen(config.port, () => {
    logger.info({ port: config.port }, 'server listening');
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown initiated');

    // Force exit if cleanup hangs — orchestrators get impatient and SIGKILL
    // the container around 30s; 10s gives in-flight requests a chance.
    const hardExit = setTimeout(() => {
      logger.error('shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    hardExit.unref();

    try {
      io.close();
      await new Promise((resolve) => server.close(resolve));
      await closePool();
      logger.info('shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'shutdown error');
      process.exit(1);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
