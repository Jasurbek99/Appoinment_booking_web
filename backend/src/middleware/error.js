import { AppError, DuplicateError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function errorMiddleware(err, req, res, _next) {
  if (err instanceof DuplicateError) {
    return res.status(409).json({ error: 'duplicate', existing: err.existing });
  }

  if (err instanceof AppError) {
    const body = { error: err.code };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.status).json(body);
  }

  // Unknown / unexpected — log full error server-side, return generic to client.
  (req.log || logger).error({ err, url: req.originalUrl, method: req.method }, 'unhandled');
  res.status(500).json({ error: 'internal' });
}
