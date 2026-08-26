import type { RequestHandler } from './$types';
import { updateScratch } from '$lib/server/world';
import { ok, parseJson, requireUser } from '$lib/server/http';
import { scratchSchema } from '$lib/server/validation';

export const PUT: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, scratchSchema);
  await updateScratch(event.params.campaignId, event.params.sessionId, user.id, input.body);
  return ok({ ok: true });
};
