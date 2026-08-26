import { and, eq, or } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { serverT } from '$lib/i18n/server';
import type { RequestHandler } from './$types';
import { canSeeNode } from '$lib/domain/permissions';
import { db } from '$lib/server/db';
import { media, nodes } from '$lib/server/db/schema';
import { requireMembership } from '$lib/server/campaigns';
import { requireUser } from '$lib/server/http';
import { getObject } from '$lib/server/storage';

export const GET: RequestHandler = async (event) => {
  const user = requireUser(event);
  const [asset] = await db.select().from(media).where(eq(media.id, event.params.mediaId)).limit(1);
  if (!asset) error(404, serverT('server.imageNotFound'));
  const membership = await requireMembership(asset.campaignId, user.id);
  if (membership.role !== 'gm' && asset.uploadedBy !== user.id) {
    const isCampaignMap = membership.campaign.mapMediaId === asset.id;
    const attached = await db
      .select({
        revealed: nodes.revealed,
        visibility: nodes.visibility,
        visibleWith: nodes.visibleWith
      })
      .from(nodes)
      .where(
        and(
          eq(nodes.campaignId, asset.campaignId),
          or(eq(nodes.imageMediaId, asset.id), eq(nodes.mapMediaId, asset.id))
        )
      );
    const allowed = attached.some((node) =>
      canSeeNode(node, user, membership.role, membership.campaign.rights)
    );
    if (!isCampaignMap && !allowed) error(404, serverT('server.imageNotFound'));
  }
  const bytes = await getObject(asset.storageKey).catch(() =>
    error(404, serverT('server.imageMissingFromStorage'))
  );
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return new Response(body, {
    headers: {
      'content-type': asset.mimeType,
      'content-length': String(asset.size),
      'cache-control': 'private, max-age=3600, immutable',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
      'x-content-type-options': 'nosniff'
    }
  });
};
