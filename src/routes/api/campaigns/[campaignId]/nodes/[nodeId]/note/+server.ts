import type { RequestHandler } from './$types';
import { updateNodeNote } from '$lib/server/world';
import { ok, parseJson, requireUser } from '$lib/server/http';
import { nodeNoteSchema } from '$lib/server/validation';

export const PUT: RequestHandler = async (event) => {
  const user = requireUser(event);
  const input = await parseJson(event.request, nodeNoteSchema);
  await updateNodeNote(event.params.campaignId, event.params.nodeId, user, input.body);
  return ok({ ok: true });
};
