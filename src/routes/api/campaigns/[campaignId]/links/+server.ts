import type { RequestHandler } from './$types';
import { connectNodes } from '$lib/server/world';
import { created, parseJson, requireUser } from '$lib/server/http';
import { linkSchema } from '$lib/server/validation';

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, linkSchema);
  return created(
    await connectNodes(event.params.campaignId, user.id, input.sourceId, input.targetId)
  );
};
