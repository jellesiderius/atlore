import { error } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { createSession, hashPassword } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { parseJson, created } from '$lib/server/http';
import { rateLimit } from '$lib/server/redis';
import { registerSchema } from '$lib/server/validation';
import { serverT } from '$lib/i18n/server';

export const POST: RequestHandler = async (event) => {
  const input = await parseJson(event.request, registerSchema);
  const ip = event.getClientAddress();
  const limit = await rateLimit(`register:${ip}`, 8, 3_600);
  if (!limit.allowed) error(429, serverT('server.tooManyLater'));
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, input.email.toLowerCase()))
    .limit(1);
  if (existing) error(409, serverT('server.accountExists'));
  const [user] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password)
    })
    .returning({ id: users.id, name: users.name, email: users.email, color: users.color });
  await createSession(user.id, event.cookies, {
    userAgent: event.request.headers.get('user-agent'),
    ipAddress: ip
  });
  return created({ user });
};
