import type { RequestHandler } from './$types';
import { createCampaign, listCampaigns } from '$lib/server/campaigns';
import { created, ok, parseJson, requireUser } from '$lib/server/http';
import { campaignCreateSchema } from '$lib/server/validation';

export const GET: RequestHandler = async (event) => {
  const user = requireUser(event);
  return ok({ campaigns: await listCampaigns(user.id) });
};

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, campaignCreateSchema);
  return created(await createCampaign(user, input));
};
