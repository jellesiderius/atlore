import type { RequestHandler } from './$types';
import { createPost } from '$lib/server/world';
import { created, parseJson, requireUser } from '$lib/server/http';
import { postSchema } from '$lib/server/validation';

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, postSchema);
  return created(await createPost(event.params.campaignId, user.id, input));
};
