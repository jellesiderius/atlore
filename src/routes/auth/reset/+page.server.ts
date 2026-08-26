import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) error(400, 'Hersteltoken ontbreekt.');
  return { token };
};
