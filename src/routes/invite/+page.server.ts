import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals }) => {
  const token = url.searchParams.get('token');
  if (!token) error(400, 'Uitnodigingstoken ontbreekt.');
  return { token, user: locals.user };
};
