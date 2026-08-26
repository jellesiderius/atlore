import { error } from '@sveltejs/kit';
import { serverT } from '$lib/i18n/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
  const token = url.searchParams.get('token');
  if (!token) error(400, serverT('server.invitationTokenMissing'));
  return { token, user: locals.user };
};
