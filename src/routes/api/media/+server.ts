import { randomUUID } from 'node:crypto';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { media } from '$lib/server/db/schema';
import { env } from '$lib/server/config';
import { serverT } from '$lib/i18n/server';
import { created, requireUser } from '$lib/server/http';
import { requireRight } from '$lib/server/campaigns';
import { putObject } from '$lib/server/storage';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const POST: RequestHandler = async (event) => {
  const user = requireUser(event);
  const form = await event.request.formData();
  const campaignId = String(form.get('campaignId') ?? '');
  const purpose = String(form.get('purpose') ?? 'image');
  const file = form.get('file');
  if (!(file instanceof File) || !campaignId) error(422, serverT('server.fileOrCampaignMissing'));
  await requireRight(campaignId, user.id, purpose === 'map' ? 'mapUpload' : 'image');
  if (!ALLOWED.has(file.type)) error(415, serverT('server.unsupportedImage'));
  const maxBytes = env.MAX_UPLOAD_MB * 1_048_576;
  if (file.size > maxBytes) {
    error(413, serverT('server.imageTooLarge', { size: env.MAX_UPLOAD_MB }));
  }
  const id = randomUUID();
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const storageKey = `${campaignId}/${id}.${extension}`;
  await putObject(storageKey, new Uint8Array(await file.arrayBuffer()), file.type);
  const [asset] = await db
    .insert(media)
    .values({
      id,
      campaignId,
      uploadedBy: user.id,
      storageKey,
      originalName: file.name.slice(0, 255),
      mimeType: file.type,
      size: file.size
    })
    .returning();
  return created({
    id: asset.id,
    name: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    url: `/api/media/${asset.id}`
  });
};
