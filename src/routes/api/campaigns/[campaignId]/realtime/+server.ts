import type { RequestHandler } from './$types';
import { requireMembership } from '$lib/server/campaigns';
import { ok, requireUser } from '$lib/server/http';
import { signRealtimeToken } from '$lib/server/realtime';

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const membership = await requireMembership(event.params.campaignId, user.id);
  return ok({
    token: signRealtimeToken({
      userId: user.id,
      userName: user.name,
      userColor: user.color,
      campaignId: event.params.campaignId,
      canEdit: membership.role === 'gm' || membership.campaign.rights.edit,
      canWrite: membership.role === 'gm' || membership.campaign.rights.write,
      expiresAt: Date.now() + 300_000
    }),
    path: '/realtime'
  });
};
