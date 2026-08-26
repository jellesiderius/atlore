import { error } from '@sveltejs/kit';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { ok, parseJson, requireUser } from '$lib/server/http';
import { accountUpdateSchema } from '$lib/server/validation';
import { serverT } from '$lib/i18n/server';

export const PATCH: RequestHandler = async (event) => {
  const current = requireUser(event);
  const input = await parseJson(event.request, accountUpdateSchema);
  const email = input.email.toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(sql`lower(${users.email})`, email), ne(users.id, current.id)))
    .limit(1);
  if (existing) error(409, serverT('server.accountExists'));

  const [user] = await db
    .update(users)
    .set({ name: input.name, email, color: input.color, updatedAt: new Date() })
    .where(eq(users.id, current.id))
    .returning({ id: users.id, name: users.name, email: users.email, color: users.color });
  return ok({ user });
};
