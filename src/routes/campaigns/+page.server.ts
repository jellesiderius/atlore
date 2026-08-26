import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listCampaigns } from '$lib/server/campaigns';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(303, '/auth/login');
  return { user: locals.user, campaigns: await listCampaigns(locals.user.id) };
};
