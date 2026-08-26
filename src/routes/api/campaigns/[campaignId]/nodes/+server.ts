import type { RequestHandler } from './$types';
import { createNode } from '$lib/server/world';
import { created, parseJson, requireUser } from '$lib/server/http';
import { nodeCreateSchema } from '$lib/server/validation';

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, nodeCreateSchema);
  return created(await createNode(event.params.campaignId, user, input));
};
