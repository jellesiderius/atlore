import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '$lib/server/config';
import * as schema from './schema';

const globalPool = globalThis as typeof globalThis & { __atlorePool?: Pool };

export const pool =
  globalPool.__atlorePool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === 'test' ? 4 : 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: true } : undefined
  });

if (env.NODE_ENV !== 'production') globalPool.__atlorePool = pool;

export const db = drizzle(pool, { schema });
