import type { RequestHandler } from './$types';
import { getWorkspace } from '$lib/server/campaigns';
import { ok, requireUser } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const user = requireUser(event);
  return ok(
    await getWorkspace(event.params.campaignId, user, event.url.searchParams.get('viewAs')),
    {
      headers: { 'cache-control': 'private, no-store' }
    }
  );
};
