import { z } from 'zod';
import type { RequestHandler } from './$types';
import { acceptInvitation } from '$lib/server/campaigns';
import { ok, parseJson, requireUser } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const { token } = await parseJson(
    event.request,
    z.object({ token: z.string().min(32).max(200) })
  );
  return ok({ campaignId: await acceptInvitation(user.id, token) });
};
