import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { createToken, hashToken } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { passwordResetTokens, users } from '$lib/server/db/schema';
import { ok, parseJson } from '$lib/server/http';
import { sendPasswordReset } from '$lib/server/mail';
import { rateLimit } from '$lib/server/redis';
import { forgotSchema } from '$lib/server/validation';
import { serverT } from '$lib/i18n/server';

export const POST: RequestHandler = async (event) => {
  const input = await parseJson(event.request, forgotSchema);
  const limit = await rateLimit(`forgot:${event.getClientAddress()}`, 5, 3_600);
  if (limit.allowed) {
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(sql`lower(${users.email})`, input.email.toLowerCase()))
      .limit(1);
    if (user) {
      const token = createToken();
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3_600_000)
      });
      await sendPasswordReset(user.email, token);
    }
  }
  return ok({ message: serverT('server.recoverySent') });
};
