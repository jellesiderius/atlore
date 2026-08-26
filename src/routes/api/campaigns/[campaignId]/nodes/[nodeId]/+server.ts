import type { RequestHandler } from './$types';
import { purgeNode, updateNode } from '$lib/server/world';
import { ok, parseJson, requireUser } from '$lib/server/http';
import { nodeUpdateSchema } from '$lib/server/validation';

export const PATCH: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, nodeUpdateSchema);
  return ok(await updateNode(event.params.campaignId, event.params.nodeId, user, input));
};

export const DELETE: RequestHandler = async (event) => {
  const user = requireUser(event);
  await purgeNode(event.params.campaignId, event.params.nodeId, user.id);
  return ok({ ok: true });
};
