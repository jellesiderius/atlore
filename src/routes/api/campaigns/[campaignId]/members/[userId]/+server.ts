import { z } from 'zod';
import type { RequestHandler } from './$types';
import { removeMember, updateMemberRole } from '$lib/server/campaigns';
import { ok, parseJson, requireUser } from '$lib/server/http';

const roleSchema = z.object({ role: z.enum(['gm', 'player']) });

export const PATCH: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, roleSchema);
  await updateMemberRole(event.params.campaignId, user.id, event.params.userId, input.role);
  return ok({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
  const user = requireUser(event);
  await removeMember(event.params.campaignId, user.id, event.params.userId);
  return ok({ ok: true });
};
