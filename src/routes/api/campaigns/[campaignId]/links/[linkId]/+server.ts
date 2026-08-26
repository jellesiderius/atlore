import type { RequestHandler } from './$types';
import { disconnectNodes } from '$lib/server/world';
import { ok, requireUser } from '$lib/server/http';

export const DELETE: RequestHandler = async (event) => {
  const user = requireUser(event);
  await disconnectNodes(event.params.campaignId, event.params.linkId, user.id);
  return ok({ ok: true });
};
