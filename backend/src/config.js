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

  EMPLOYEE_API_URL: z.string().url().optional().or(z.literal('')),
  EMPLOYEE_API_KEY: z.string().optional(),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;
const isTestRun = process.argv.includes('--test') || env.NODE_ENV === 'test';

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
  employeeApi: {
    url: env.EMPLOYEE_API_URL || null,
    key: env.EMPLOYEE_API_KEY || null,
  },
  corsOrigin: env.CORS_ORIGIN,
  isProduction: env.NODE_ENV === 'production',
};
