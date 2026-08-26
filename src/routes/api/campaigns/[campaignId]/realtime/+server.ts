import type { RequestHandler } from './$types';
import { requireMembership } from '$lib/server/campaigns';
import { ok, requireUser } from '$lib/server/http';
import { signRealtimeToken } from '$lib/server/realtime';

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  await requireMembership(event.params.campaignId, user.id);
  return ok({
    token: signRealtimeToken({
      userId: user.id,
      campaignId: event.params.campaignId,
      expiresAt: Date.now() + 300_000
    }),
    path: '/realtime'
  });
};
