import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getWorkspace } from '$lib/server/campaigns';

export const load: PageServerLoad = async ({ locals, params, url }) => {
  if (!locals.user) redirect(303, `/auth/login?next=/campaigns/${params.campaignId}`);
  return {
    snapshot: await getWorkspace(params.campaignId, locals.user, url.searchParams.get('viewAs'))
  };
};
