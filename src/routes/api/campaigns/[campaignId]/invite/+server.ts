import type { RequestHandler } from './$types';
import { inviteMember, requireMembership } from '$lib/server/campaigns';
import { created, parseJson, requireUser } from '$lib/server/http';
import { sendInvitation } from '$lib/server/mail';
import { inviteSchema } from '$lib/server/validation';

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, inviteSchema);
  const { token, invitationId } = await inviteMember(event.params.campaignId, user.id, input);
  const membership = await requireMembership(event.params.campaignId, user.id);
  await sendInvitation(input.email, membership.campaign.title, token);
  return created({ id: invitationId });
};
