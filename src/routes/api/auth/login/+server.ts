import { error } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { createSession, verifyPassword } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { ok, parseJson } from '$lib/server/http';
import { clearRateLimit, rateLimit } from '$lib/server/redis';
import { loginSchema } from '$lib/server/validation';
import { serverT } from '$lib/i18n/server';

export const POST: RequestHandler = async (event) => {
  const input = await parseJson(event.request, loginSchema);
  const ip = event.getClientAddress();
  const rateLimitKey = `login:${ip}:${input.email.toLowerCase()}`;
  const limit = await rateLimit(rateLimitKey, 10, 900);
  if (!limit.allowed) error(429, serverT('server.tooManyMinutes'));
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, input.email.toLowerCase()))
    .limit(1);
  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    error(401, serverT('server.loginFailed'));
  }
  await clearRateLimit(rateLimitKey);
  await createSession(user.id, event.cookies, {
    userAgent: event.request.headers.get('user-agent'),
    ipAddress: ip
  });
  return ok({ user: { id: user.id, name: user.name, email: user.email, color: user.color } });
};
