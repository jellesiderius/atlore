import type { RequestHandler } from './$types';
import { createSession } from '$lib/server/world';
import { created, parseJson, requireUser } from '$lib/server/http';
import { sessionCreateSchema } from '$lib/server/validation';

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, sessionCreateSchema);
  return created(await createSession(event.params.campaignId, user.id, input));
};
