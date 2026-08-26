import type { RequestHandler } from './$types';
import { updateDescription } from '$lib/server/world';
import { ok, parseJson, requireUser } from '$lib/server/http';
import { descriptionSchema } from '$lib/server/validation';

export const PUT: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, descriptionSchema);
  await updateDescription(event.params.campaignId, event.params.nodeId, user, input.body);
  return ok({ ok: true });
};
