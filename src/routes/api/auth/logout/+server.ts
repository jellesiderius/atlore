import type { RequestHandler } from './$types';
import { clearSessionCookie, deleteSession } from '$lib/server/auth';
import { ok } from '$lib/server/http';

export const POST: RequestHandler = async ({ locals, cookies }) => {
  await deleteSession(locals.sessionId);
  clearSessionCookie(cookies);
  return ok({ ok: true });
};
