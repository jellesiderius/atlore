import { error } from '@sveltejs/kit';
import { serverT } from '$lib/i18n/server';
import type { RequestHandler } from './$types';
import { listVersions, restoreVersion } from '$lib/server/world';
import { ok, requireUser } from '$lib/server/http';

export const GET: RequestHandler = async (event) => {
  const user = requireUser(event);
  const type = event.url.searchParams.get('type');
  const entityId = event.url.searchParams.get('entityId');
  if ((type !== 'node' && type !== 'session') || !entityId) {
    error(422, serverT('server.invalidVersionQuery'));
  }
  return ok({ versions: await listVersions(event.params.campaignId, type, entityId, user.id) });
};

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const value = (await event.request.json().catch(() => null)) as { versionId?: string } | null;
  if (!value?.versionId) error(422, serverT('server.versionMissing'));
  await restoreVersion(event.params.campaignId, value.versionId, user);
  return ok({ ok: true });
};
