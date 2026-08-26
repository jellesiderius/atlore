import type { RequestHandler } from './$types';
import { addNodeType } from '$lib/server/world';
import { created, parseJson, requireUser } from '$lib/server/http';
import { nodeTypeSchema } from '$lib/server/validation';

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, nodeTypeSchema);
  await addNodeType(event.params.campaignId, user.id, input);
  return created({ ok: true });
};
