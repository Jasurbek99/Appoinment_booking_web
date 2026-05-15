import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  DB_SERVER: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: z.string().min(1),
  DB_NAME_TEST: z.string().min(1).default('appointments_test'),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  INITIAL_SECRETARY_PASSWORD: z.string().optional(),

  EMPLOYEE_DB_SERVER: z.string().min(1),
  EMPLOYEE_DB_PORT: z.coerce.number().int().positive().default(1433),
  EMPLOYEE_DB_NAME: z.string().min(1),
  EMPLOYEE_DB_USER: z.string().min(1),
  EMPLOYEE_DB_PASSWORD: z.string().min(1),

  // Comma-separated list of allowed origins. Empty string disables CORS
  // (use this when frontend and backend share an origin behind nginx).
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Number of reverse-proxy hops in front of Express. 0 = direct, 1 = one nginx, etc.
  // Required for correct req.ip and Secure cookie behavior behind a proxy.
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Hard cap on JSON request bodies. Anything larger gets a 413.
  BODY_LIMIT: z.string().default('100kb'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;
const isTestRun = process.argv.includes('--test') || env.NODE_ENV === 'test';
const isProduction = env.NODE_ENV === 'production';

if (isProduction) {
  const weakSecrets = ['changeme', 'secret', 'replace-with-a-long-random-string-at-least-32-chars'];
  if (weakSecrets.some((w) => env.JWT_SECRET.toLowerCase().includes(w))) {
    console.error('JWT_SECRET in production must not contain a placeholder value.');
    process.exit(1);
  }
}

const corsOrigin = env.CORS_ORIGIN
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: '24h',
  },
  bcryptRounds: env.BCRYPT_ROUNDS,
  db: {
    server: env.DB_SERVER,
    port: env.DB_PORT,
    database: isTestRun ? env.DB_NAME_TEST : env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  },
  initialSecretaryPassword: env.INITIAL_SECRETARY_PASSWORD,
  employeeDb: {
    server: env.EMPLOYEE_DB_SERVER,
    port: env.EMPLOYEE_DB_PORT,
    database: env.EMPLOYEE_DB_NAME,
    user: env.EMPLOYEE_DB_USER,
    password: env.EMPLOYEE_DB_PASSWORD,
  },
  corsOrigin,
  trustProxy: env.TRUST_PROXY,
  logLevel: env.LOG_LEVEL,
  bodyLimit: env.BODY_LIMIT,
  isProduction,
};
