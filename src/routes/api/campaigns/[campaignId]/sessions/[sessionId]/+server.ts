import type { RequestHandler } from './$types';
import { purgeSession, updateSession } from '$lib/server/world';
import { ok, parseJson, requireUser } from '$lib/server/http';
import { sessionUpdateSchema } from '$lib/server/validation';

export const PATCH: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, sessionUpdateSchema);
  return ok(await updateSession(event.params.campaignId, event.params.sessionId, user, input));
};

export const DELETE: RequestHandler = async (event) => {
  const user = requireUser(event);
  await purgeSession(event.params.campaignId, event.params.sessionId, user.id);
  return ok({ ok: true });
};
