import { and, eq, gt, isNull } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSession, hashPassword, hashToken } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { authSessions, passwordResetTokens, users } from '$lib/server/db/schema';
import { ok, parseJson } from '$lib/server/http';
import { resetSchema } from '$lib/server/validation';
import { serverT } from '$lib/i18n/server';

export const POST: RequestHandler = async (event) => {
  const input = await parseJson(event.request, resetSchema);
  const [reset] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashToken(input.token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!reset) error(404, serverT('server.resetExpired'));
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: await hashPassword(input.password), updatedAt: new Date() })
      .where(eq(users.id, reset.userId));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, reset.id));
    await tx.delete(authSessions).where(eq(authSessions.userId, reset.userId));
  });
  await createSession(reset.userId, event.cookies, {
    userAgent: event.request.headers.get('user-agent'),
    ipAddress: event.getClientAddress()
  });
  return ok({ ok: true });
};
