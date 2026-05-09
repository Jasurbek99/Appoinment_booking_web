import { AppError, DuplicateError } from '../lib/errors.js';

export function errorMiddleware(err, _req, res, _next) {
  if (err instanceof DuplicateError) {
    return res.status(409).json({ error: 'duplicate', existing: err.existing });
  }

  if (err instanceof AppError) {
    const body = { error: err.code };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.status).json(body);
  }

  // Unknown / unexpected
  console.error('[error]', err);
  res.status(500).json({ error: 'internal' });
}
