import type { RequestHandler } from './$types';
import { deleteCampaign, updateCampaign } from '$lib/server/campaigns';
import { ok, parseJson, requireUser } from '$lib/server/http';
import { campaignUpdateSchema } from '$lib/server/validation';

export const PATCH: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, campaignUpdateSchema);
  await updateCampaign(event.params.campaignId, user.id, input);
  return ok({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
  const user = requireUser(event);
  await deleteCampaign(event.params.campaignId, user.id);
  return ok({ ok: true });
};
