import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ORIGIN: z.url().default('http://localhost:3000'),
  TRUSTED_ORIGINS: z.string().default(''),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).optional(),
  SESSION_COOKIE_NAME: z.string().default('atlore_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default('eu-west-1'),
  S3_BUCKET: z.string().default('atlore'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  STORAGE_PATH: z.string().default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(50).default(12),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('Atlore <noreply@atlore.local>'),
  REALTIME_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export const env = schema.parse(process.env);

export const useSecureCookies = new URL(env.ORIGIN).protocol === 'https:';

export const trustedOrigins = env.TRUSTED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
