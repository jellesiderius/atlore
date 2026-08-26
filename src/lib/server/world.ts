import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { serverT } from '$lib/i18n/server';
import { bodyToText, normalizeBody, referencedNodeIds } from '$lib/domain/text';
import { canSeeNode } from '$lib/domain/permissions';
import { db } from '$lib/server/db';
import {
  links,
  mutedAutoLinks,
  nodeDescriptions,
  nodes,
  nodeTypes,
  posts,
  sessionScratch,
  sessions,
  versions
} from '$lib/server/db/schema';
import { invalidateCampaign } from '$lib/server/redis';
import { log, requireMembership, requireRight } from '$lib/server/campaigns';
import type { Paragraph, SessionUser } from '$lib/types';

type NodeCreate = {
  title: string;
  type: string;
  size: 's' | 'm' | 'l';
  summary: string;
  revealed: boolean;
  visibility: 'all' | 'sel' | 'me';
  visibleWith: string[];
  x: number;
  y: number;
  connectTo: string[];
};

export async function createNode(campaignId: string, user: SessionUser, input: NodeCreate) {
  const membership = await requireRight(campaignId, user.id, 'create');
  const [type] = await db
    .select({ key: nodeTypes.key })
    .from(nodeTypes)
    .where(and(eq(nodeTypes.campaignId, campaignId), eq(nodeTypes.key, input.type)))
    .limit(1);
  if (!type || type.key === 'session') error(422, serverT('server.invalidNodeType'));
  await assertVisibleNodeIds(campaignId, [...new Set(input.connectTo)], user.id, membership);
  const node = await db.transaction(async (tx) => {
    const playerPrivate =
      membership.role === 'player' && (!input.revealed || input.visibility === 'me');
    const [created] = await tx
      .insert(nodes)
      .values({
        campaignId,
        typeKey: input.type,
        title: input.title,
        size: input.size,
        summary: input.summary,
        revealed: playerPrivate ? true : input.revealed,
        visibility: playerPrivate ? 'sel' : input.visibility,
        visibleWith: playerPrivate ? [user.id] : input.visibleWith,
        x: input.x,
        y: input.y,
        createdBy: user.id,
        updatedBy: user.id
      })
      .returning();
    for (const targetId of [...new Set(input.connectTo)]) {
      if (targetId === created.id) continue;
      const [sourceId, canonicalTarget] = canonicalPair(created.id, targetId);
      await tx
        .insert(links)
        .values({ campaignId, sourceId, targetId: canonicalTarget, createdBy: user.id })
        .onConflictDoNothing();
    }
    return created;
  });
  await log(campaignId, user.id, 'node.created', 'node', node.id);
  await invalidateCampaign(campaignId, 'nodes');
  return node;
}

export async function updateNode(
  campaignId: string,
  nodeId: string,
  user: SessionUser,
  values: Record<string, unknown>
) {
  const membership = await requireRight(campaignId, user.id, 'edit');
  const node = await getNodeRow(campaignId, nodeId);
  assertNodeVisible(node, user.id, membership);
  if ('revealed' in values || 'visibility' in values || 'visibleWith' in values) {
    await requireRight(campaignId, user.id, 'reveal');
  }
  if ('imageMediaId' in values || 'mapMediaId' in values)
    await requireRight(campaignId, user.id, 'image');
  if ('pinX' in values || 'pinY' in values || 'pinMapId' in values || 'markerLocked' in values) {
    await requireRight(campaignId, user.id, 'pin');
  }
  if (values.type) {
    const [type] = await db
      .select({ key: nodeTypes.key })
      .from(nodeTypes)
      .where(and(eq(nodeTypes.campaignId, campaignId), eq(nodeTypes.key, String(values.type))))
      .limit(1);
    if (!type || type.key === 'session') error(422, serverT('server.invalidNodeType'));
  }
  if (values.trashed !== undefined) {
    if (values.trashed) await requireRight(campaignId, user.id, 'delete');
    values.trashedAt = values.trashed ? new Date() : null;
    delete values.trashed;
  }
  const mapped = { ...values } as Record<string, unknown>;
  if ('type' in mapped) {
    mapped.typeKey = mapped.type;
    delete mapped.type;
  }
  await saveNodeVersion(campaignId, node, user);
  const [updated] = await db
    .update(nodes)
    .set({ ...mapped, updatedAt: new Date(), updatedBy: user.id })
    .where(and(eq(nodes.id, nodeId), eq(nodes.campaignId, campaignId)))
    .returning();
  await log(
    campaignId,
    user.id,
    values.trashedAt ? 'node.trashed' : 'node.updated',
    'node',
    nodeId
  );
  await invalidateCampaign(campaignId, 'nodes');
  return updated;
}

export async function purgeNode(campaignId: string, nodeId: string, userId: string): Promise<void> {
  const membership = await requireMembership(campaignId, userId);
  if (membership.role !== 'gm') error(403, serverT('server.purgeGmOnly'));
  const node = await getNodeRow(campaignId, nodeId);
  if (!node.trashedAt) error(409, serverT('server.trashNodeFirst'));
  await db.delete(nodes).where(eq(nodes.id, nodeId));
  await log(campaignId, userId, 'node.purged', 'node', nodeId);
  await invalidateCampaign(campaignId, 'nodes');
}

export async function updateDescription(
  campaignId: string,
  nodeId: string,
  user: SessionUser,
  body: Paragraph[]
) {
  const membership = await requireRight(campaignId, user.id, 'edit');
  const node = await getNodeRow(campaignId, nodeId);
  assertNodeVisible(node, user.id, membership);
  const normalized = normalizeBody(body);
  await assertVisibleNodeIds(campaignId, [...referencedNodeIds(normalized)], user.id, membership);
  await saveNodeVersion(campaignId, node, user);
  await db
    .update(nodes)
    .set({
      description: normalized,
      descriptionPlainText: bodyToText(normalized),
      updatedBy: user.id,
      updatedAt: new Date()
    })
    .where(and(eq(nodes.id, nodeId), eq(nodes.campaignId, campaignId)));
  await syncDescriptionLinks(campaignId, nodeId, user.id, normalized);
  await invalidateCampaign(campaignId, 'descriptions');
}

export async function updateNodeNote(
  campaignId: string,
  nodeId: string,
  user: SessionUser,
  body: Paragraph[]
) {
  const membership = await requireRight(campaignId, user.id, 'write');
  const node = await getNodeRow(campaignId, nodeId);
  assertNodeVisible(node, user.id, membership);
  const normalized = normalizeBody(body);
  await assertVisibleNodeIds(campaignId, [...referencedNodeIds(normalized)], user.id, membership);
  await db
    .insert(nodeDescriptions)
    .values({
      nodeId,
      userId: user.id,
      body: normalized,
      plainText: bodyToText(normalized),
      shared: false,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [nodeDescriptions.nodeId, nodeDescriptions.userId],
      set: {
        body: normalized,
        plainText: bodyToText(normalized),
        shared: false,
        updatedAt: new Date()
      }
    });
  await invalidateCampaign(campaignId, 'node-notes');
}

export async function connectNodes(
  campaignId: string,
  userId: string,
  source: string,
  target: string
) {
  const membership = await requireRight(campaignId, userId, 'link');
  if (source === target) error(422, serverT('server.selfLink'));
  await assertVisibleNodeIds(campaignId, [source, target], userId, membership);
  const [sourceId, targetId] = canonicalPair(source, target);
  const [link] = await db
    .insert(links)
    .values({ campaignId, sourceId, targetId, createdBy: userId })
    .onConflictDoUpdate({
      target: [links.campaignId, links.sourceId, links.targetId],
      set: { fromDescription: false, sourceNodeId: null }
    })
    .returning();
  await db
    .delete(mutedAutoLinks)
    .where(
      and(
        eq(mutedAutoLinks.campaignId, campaignId),
        eq(mutedAutoLinks.sourceId, sourceId),
        eq(mutedAutoLinks.targetId, targetId)
      )
    );
  await log(campaignId, userId, 'link.created', 'link', link.id);
  await invalidateCampaign(campaignId, 'links');
  return link;
}

export async function disconnectNodes(campaignId: string, linkId: string, userId: string) {
  const membership = await requireRight(campaignId, userId, 'link');
  const [link] = await db
    .select()
    .from(links)
    .where(and(eq(links.id, linkId), eq(links.campaignId, campaignId)))
    .limit(1);
  if (!link) error(404, serverT('server.linkNotFound'));
  await assertVisibleNodeIds(campaignId, [link.sourceId, link.targetId], userId, membership);
  await db.transaction(async (tx) => {
    await tx.delete(links).where(eq(links.id, linkId));
    if (link.fromDescription) {
      await tx
        .insert(mutedAutoLinks)
        .values({ campaignId, sourceId: link.sourceId, targetId: link.targetId })
        .onConflictDoNothing();
    }
  });
  await log(campaignId, userId, 'link.deleted', 'link', linkId);
  await invalidateCampaign(campaignId, 'links');
}

export async function createSession(
  campaignId: string,
  userId: string,
  input: { title: string; worldDate: string; body?: Paragraph[] }
) {
  await requireRight(campaignId, userId, 'session');
  const [last] = await db
    .select({ sequence: sessions.sequence })
    .from(sessions)
    .where(eq(sessions.campaignId, campaignId))
    .orderBy(desc(sessions.sequence))
    .limit(1);
  const body = normalizeBody(input.body);
  const [session] = await db
    .insert(sessions)
    .values({
      campaignId,
      title: input.title,
      worldDate: input.worldDate,
      sequence: (last?.sequence ?? 0) + 1,
      body,
      plainText: bodyToText(body),
      createdBy: userId,
      updatedBy: userId
    })
    .returning();
  await log(campaignId, userId, 'session.created', 'session', session.id);
  await invalidateCampaign(campaignId, 'sessions');
  return session;
}

export async function updateSession(
  campaignId: string,
  sessionId: string,
  user: SessionUser,
  input: { title?: string; worldDate?: string; body?: Paragraph[]; trashed?: boolean }
) {
  await requireRight(campaignId, user.id, 'write');
  const session = await getSessionRow(campaignId, sessionId);
  if (input.trashed) await requireRight(campaignId, user.id, 'delete');
  await saveSessionVersion(campaignId, session, user);
  const body = input.body ? normalizeBody(input.body) : undefined;
  const [updated] = await db
    .update(sessions)
    .set({
      title: input.title,
      worldDate: input.worldDate,
      body,
      plainText: body ? bodyToText(body) : undefined,
      trashedAt: input.trashed === undefined ? undefined : input.trashed ? new Date() : null,
      updatedBy: user.id,
      updatedAt: new Date()
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.campaignId, campaignId)))
    .returning();
  await log(
    campaignId,
    user.id,
    input.trashed ? 'session.trashed' : 'session.updated',
    'session',
    sessionId
  );
  await invalidateCampaign(campaignId, 'sessions');
  return updated;
}

export async function purgeSession(
  campaignId: string,
  sessionId: string,
  userId: string
): Promise<void> {
  const membership = await requireMembership(campaignId, userId);
  if (membership.role !== 'gm') error(403, serverT('server.purgeGmOnly'));
  const session = await getSessionRow(campaignId, sessionId);
  if (!session.trashedAt) error(409, serverT('server.trashSessionFirst'));
  await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.campaignId, campaignId)));
  await log(campaignId, userId, 'session.purged', 'session', sessionId);
  await invalidateCampaign(campaignId, 'sessions');
}

export async function updateScratch(
  campaignId: string,
  sessionId: string,
  userId: string,
  body: Paragraph[]
) {
  await requireRight(campaignId, userId, 'write');
  await getSessionRow(campaignId, sessionId);
  const normalized = normalizeBody(body);
  await db
    .insert(sessionScratch)
    .values({ sessionId, userId, body: normalized, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [sessionScratch.sessionId, sessionScratch.userId],
      set: { body: normalized, updatedAt: new Date() }
    });
  await invalidateCampaign(campaignId, 'scratch');
}

export async function createPost(
  campaignId: string,
  userId: string,
  input: {
    nodeId: string;
    kind: 'note' | 'theory' | 'goal';
    visibility: 'all' | 'me' | 'gm' | 'sel';
    visibleWith: string[];
    text: string;
  }
) {
  const membership = await requireRight(campaignId, userId, 'edit');
  const node = await getNodeRow(campaignId, input.nodeId);
  assertNodeVisible(node, userId, membership);
  const [post] = await db
    .insert(posts)
    .values({ userId, ...input })
    .returning();
  await invalidateCampaign(campaignId, 'posts');
  return post;
}

export async function addNodeType(
  campaignId: string,
  userId: string,
  input: {
    key: string;
    pluralName: string;
    singularName: string;
    colorDark: string;
    colorLight: string;
  }
) {
  await requireRight(campaignId, userId, 'settings');
  const [existing] = await db
    .select({ key: nodeTypes.key })
    .from(nodeTypes)
    .where(and(eq(nodeTypes.campaignId, campaignId), eq(nodeTypes.key, input.key)))
    .limit(1);
  if (existing) error(409, serverT('server.nodeTypeExists'));
  await db.insert(nodeTypes).values({ campaignId, ...input, custom: true });
  await invalidateCampaign(campaignId, 'types');
}

export async function removeNodeType(campaignId: string, userId: string, key: string) {
  await requireRight(campaignId, userId, 'settings');
  const [type] = await db
    .select()
    .from(nodeTypes)
    .where(and(eq(nodeTypes.campaignId, campaignId), eq(nodeTypes.key, key)))
    .limit(1);
  if (!type?.custom) error(409, serverT('server.builtinType'));
  const [used] = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(and(eq(nodes.campaignId, campaignId), eq(nodes.typeKey, key)))
    .limit(1);
  if (used) error(409, serverT('server.typeInUse'));
  await db
    .delete(nodeTypes)
    .where(and(eq(nodeTypes.campaignId, campaignId), eq(nodeTypes.key, key)));
  await invalidateCampaign(campaignId, 'types');
}

export async function listVersions(
  campaignId: string,
  entityType: 'node' | 'session',
  entityId: string,
  userId: string
) {
  const membership = await requireRight(campaignId, userId, 'history');
  if (entityType === 'node') {
    const node = await getNodeRow(campaignId, entityId);
    assertNodeVisible(node, userId, membership);
  } else {
    await getSessionRow(campaignId, entityId);
  }
  return db
    .select()
    .from(versions)
    .where(
      and(
        eq(versions.campaignId, campaignId),
        eq(versions.entityType, entityType),
        eq(versions.entityId, entityId)
      )
    )
    .orderBy(desc(versions.createdAt))
    .limit(25);
}

export async function restoreVersion(campaignId: string, versionId: string, user: SessionUser) {
  const membership = await requireRight(campaignId, user.id, 'history');
  const [version] = await db
    .select()
    .from(versions)
    .where(and(eq(versions.id, versionId), eq(versions.campaignId, campaignId)))
    .limit(1);
  if (!version) error(404, serverT('server.versionNotFound'));
  if (version.entityType === 'session') {
    const session = await getSessionRow(campaignId, version.entityId);
    await saveSessionVersion(campaignId, session, user, true);
    await db
      .update(sessions)
      .set({
        title: version.snapshot.title,
        worldDate: version.snapshot.worldDate ?? '',
        body: version.snapshot.body,
        plainText: bodyToText(version.snapshot.body),
        updatedBy: user.id,
        updatedAt: new Date()
      })
      .where(eq(sessions.id, version.entityId));
  } else {
    const node = await getNodeRow(campaignId, version.entityId);
    assertNodeVisible(node, user.id, membership);
    await saveNodeVersion(campaignId, node, user, true);
    await db
      .update(nodes)
      .set({
        title: version.snapshot.title,
        summary: version.snapshot.summary ?? '',
        description: normalizeBody(version.snapshot.body),
        descriptionPlainText: bodyToText(normalizeBody(version.snapshot.body)),
        updatedBy: user.id,
        updatedAt: new Date()
      })
      .where(eq(nodes.id, version.entityId));
    await syncDescriptionLinks(campaignId, version.entityId, user.id, version.snapshot.body);
  }
  await invalidateCampaign(campaignId, 'versions');
}

function canonicalPair(a: string, b: string): [string, string] {
  return a.localeCompare(b) < 0 ? [a, b] : [b, a];
}

async function getNodeRow(campaignId: string, nodeId: string) {
  const [node] = await db
    .select()
    .from(nodes)
    .where(and(eq(nodes.id, nodeId), eq(nodes.campaignId, campaignId)))
    .limit(1);
  if (!node) error(404, serverT('server.nodeNotFound'));
  return node;
}

type AccessMembership = Awaited<ReturnType<typeof requireMembership>>;

function assertNodeVisible(
  node: Pick<typeof nodes.$inferSelect, 'revealed' | 'visibility' | 'visibleWith'>,
  userId: string,
  membership: AccessMembership
) {
  if (!canSeeNode(node, { id: userId }, membership.role, membership.campaign.rights)) {
    error(404, serverT('server.nodeNotFound'));
  }
}

async function assertVisibleNodeIds(
  campaignId: string,
  nodeIds: string[],
  userId: string,
  membership: AccessMembership
) {
  const uniqueIds = [...new Set(nodeIds)];
  if (!uniqueIds.length) return;
  const rows = await db
    .select()
    .from(nodes)
    .where(
      and(eq(nodes.campaignId, campaignId), inArray(nodes.id, uniqueIds), isNull(nodes.trashedAt))
    );
  if (rows.length !== uniqueIds.length) error(404, serverT('server.someNodesNotFound'));
  for (const node of rows) assertNodeVisible(node, userId, membership);
}

async function getSessionRow(campaignId: string, sessionId: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.campaignId, campaignId)))
    .limit(1);
  if (!session) error(404, serverT('server.sessionNotFound'));
  return session;
}

async function saveNodeVersion(
  campaignId: string,
  node: typeof nodes.$inferSelect,
  user: SessionUser,
  force = false
) {
  const [latest] = await db
    .select({ createdAt: versions.createdAt })
    .from(versions)
    .where(and(eq(versions.entityType, 'node'), eq(versions.entityId, node.id)))
    .orderBy(desc(versions.createdAt))
    .limit(1);
  if (!force && latest && Date.now() - latest.createdAt.getTime() < 45_000) return;
  await db.insert(versions).values({
    campaignId,
    entityType: 'node',
    entityId: node.id,
    byUserId: user.id,
    byName: user.name,
    snapshot: { title: node.title, summary: node.summary, body: normalizeBody(node.description) }
  });
  await trimVersions(campaignId, 'node', node.id);
}

async function saveSessionVersion(
  campaignId: string,
  session: typeof sessions.$inferSelect,
  user: SessionUser,
  force = false
) {
  const [latest] = await db
    .select({ createdAt: versions.createdAt })
    .from(versions)
    .where(and(eq(versions.entityType, 'session'), eq(versions.entityId, session.id)))
    .orderBy(desc(versions.createdAt))
    .limit(1);
  if (!force && latest && Date.now() - latest.createdAt.getTime() < 45_000) return;
  await db.insert(versions).values({
    campaignId,
    entityType: 'session',
    entityId: session.id,
    byUserId: user.id,
    byName: user.name,
    snapshot: {
      title: session.title,
      worldDate: session.worldDate,
      body: normalizeBody(session.body)
    }
  });
  await trimVersions(campaignId, 'session', session.id);
}

async function trimVersions(campaignId: string, entityType: 'node' | 'session', entityId: string) {
  const old = await db
    .select({ id: versions.id })
    .from(versions)
    .where(
      and(
        eq(versions.campaignId, campaignId),
        eq(versions.entityType, entityType),
        eq(versions.entityId, entityId)
      )
    )
    .orderBy(desc(versions.createdAt))
    .offset(25);
  if (old.length)
    await db.delete(versions).where(
      inArray(
        versions.id,
        old.map(({ id }) => id)
      )
    );
}

async function syncDescriptionLinks(
  campaignId: string,
  nodeId: string,
  userId: string,
  body: Paragraph[]
) {
  const references = [...referencedNodeIds(body)].filter((id) => id !== nodeId);
  const muted = references.length
    ? await db
        .select()
        .from(mutedAutoLinks)
        .where(
          and(
            eq(mutedAutoLinks.campaignId, campaignId),
            or(
              ...references.map((id) => {
                const [sourceId, targetId] = canonicalPair(nodeId, id);
                return and(
                  eq(mutedAutoLinks.sourceId, sourceId),
                  eq(mutedAutoLinks.targetId, targetId)
                );
              })
            )
          )
        )
    : [];
  const mutedKeys = new Set(muted.map((item) => `${item.sourceId}:${item.targetId}`));
  await db.transaction(async (tx) => {
    await tx
      .delete(links)
      .where(
        and(
          eq(links.campaignId, campaignId),
          eq(links.fromDescription, true),
          eq(links.sourceNodeId, nodeId)
        )
      );
    for (const id of references) {
      const [sourceId, targetId] = canonicalPair(nodeId, id);
      if (mutedKeys.has(`${sourceId}:${targetId}`)) continue;
      await tx
        .insert(links)
        .values({
          campaignId,
          sourceId,
          targetId,
          relation: 'related_to',
          fromDescription: true,
          sourceNodeId: nodeId,
          createdBy: userId
        })
        .onConflictDoNothing();
    }
  });
}
