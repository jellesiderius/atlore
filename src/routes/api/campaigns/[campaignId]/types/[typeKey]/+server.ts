import type { RequestHandler } from './$types';
import { removeNodeType } from '$lib/server/world';
import { ok, requireUser } from '$lib/server/http';

export const DELETE: RequestHandler = async (event) => {
  const user = requireUser(event);
  await removeNodeType(event.params.campaignId, user.id, event.params.typeKey);
  return ok({ ok: true });
};
