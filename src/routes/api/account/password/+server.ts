import { error } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { hashPassword, verifyPassword } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { authSessions, users } from '$lib/server/db/schema';
import { ok, parseJson, requireUser } from '$lib/server/http';
import { rateLimit } from '$lib/server/redis';
import { passwordChangeSchema } from '$lib/server/validation';
import { serverT } from '$lib/i18n/server';

export const PATCH: RequestHandler = async (event) => {
  const current = requireUser(event);
  const input = await parseJson(event.request, passwordChangeSchema);
  const limit = await rateLimit(`password-change:${current.id}`, 8, 3_600);
  if (!limit.allowed) error(429, serverT('server.tooManyLater'));

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, current.id))
    .limit(1);
  if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    error(401, serverT('server.currentPasswordWrong'));
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.newPassword), updatedAt: new Date() })
    .where(eq(users.id, current.id));
  if (event.locals.sessionId) {
    await db
      .delete(authSessions)
      .where(and(eq(authSessions.userId, current.id), ne(authSessions.id, event.locals.sessionId)));
  }
  return ok({ ok: true });
};
