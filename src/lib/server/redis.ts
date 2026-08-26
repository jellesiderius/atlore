import Redis from 'ioredis';
import { env } from '$lib/server/config';

let client: Redis | null | undefined;
const memoryLimits = new Map<string, { count: number; expiresAt: number }>();

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  if (!env.REDIS_URL) return (client = null);
  client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => (attempt > 3 ? null : Math.min(attempt * 200, 1_000))
  });
  client.on('error', () => undefined);
  void client.connect().catch(() => undefined);
  return client;
}

export async function redisHealthy(timeoutMs = 1_500): Promise<boolean | null> {
  const redis = getRedis();
  if (!redis) return null;
  if (redis.status !== 'ready') {
    const ready = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      redis.once('ready', () => {
        clearTimeout(timer);
        resolve(true);
      });
      redis.once('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
    if (!ready) return false;
  }
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const redis = getRedis();
  if (redis?.status === 'ready') {
    const namespaced = `atlore:limit:${key}`;
    const multi = redis.multi();
    multi.incr(namespaced);
    multi.ttl(namespaced);
    const result = await multi.exec();
    const count = Number(result?.[0]?.[1] ?? 1);
    let ttl = Number(result?.[1]?.[1] ?? -1);
    if (ttl < 0) {
      await redis.expire(namespaced, windowSeconds);
      ttl = windowSeconds;
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfter: ttl };
  }

  const now = Date.now();
  const current = memoryLimits.get(key);
  const entry =
    !current || current.expiresAt <= now
      ? { count: 0, expiresAt: now + windowSeconds * 1_000 }
      : current;
  entry.count += 1;
  memoryLimits.set(key, entry);
  if (memoryLimits.size > 5_000) {
    for (const [itemKey, item] of memoryLimits)
      if (item.expiresAt <= now) memoryLimits.delete(itemKey);
  }
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfter: Math.max(1, Math.ceil((entry.expiresAt - now) / 1_000))
  };
}

export async function clearRateLimit(key: string): Promise<void> {
  memoryLimits.delete(key);
  const redis = getRedis();
  if (redis?.status === 'ready') await redis.del(`atlore:limit:${key}`).catch(() => undefined);
}

export async function invalidateCampaign(campaignId: string, resource = 'world'): Promise<void> {
  const redis = getRedis();
  if (redis?.status === 'ready') {
    await Promise.all([
      redis.publish(`atlore:campaign:${campaignId}`, JSON.stringify({ resource, at: Date.now() }))
    ]).catch(() => undefined);
  }
}
