import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { redisHealthy } from '$lib/server/redis';

export const GET: RequestHandler = async () => {
  const database = await db
    .execute(sql`select 1`)
    .then(() => true)
    .catch(() => false);
  const redis = await redisHealthy();
  return Response.json(
    { status: database ? 'ok' : 'degraded', database, redis, at: new Date().toISOString() },
    { status: database ? 200 : 503, headers: { 'cache-control': 'no-store' } }
  );
};
