import { pino } from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.env === 'test' ? 'silent' : config.logLevel,
  base: { env: config.env },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
      '*.password_hash',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
});
