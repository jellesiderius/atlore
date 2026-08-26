import { randomBytes } from 'node:crypto';
import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { serverT } from '$lib/i18n/server';
import { DEFAULT_RIGHTS, BUILTIN_NODE_TYPES } from '$lib/domain/constants';
import { normalizeBody } from '$lib/domain/text';
import { canSeeNode, may } from '$lib/domain/permissions';
import { db } from '$lib/server/db';
import {
  auditLog,
  campaignMembers,
  campaigns,
  invitations,
  links,
  media,
  nodeDescriptions,
  nodes,
  nodeTypes,
  posts,
  sessionScratch,
  sessions,
  users
} from '$lib/server/db/schema';
import { hashToken } from '$lib/server/auth';
import { invalidateCampaign } from '$lib/server/redis';
import type {
  Campaign,
  CampaignMember,
  CampaignSummary,
  ForceSettings,
  NodePost,
  RightKey,
  SessionEntry,
  SessionScratch,
  SessionUser,
  WorkspaceSnapshot,
  WorldLink,
  WorldNode
} from '$lib/types';

type Membership = {
  role: 'gm' | 'player';
  campaign: typeof campaigns.$inferSelect;
};

export async function requireMembership(campaignId: string, userId: string): Promise<Membership> {
  const [row] = await db
    .select({ role: campaignMembers.role, campaign: campaigns })
    .from(campaignMembers)
    .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
    .where(
      and(
        eq(campaignMembers.campaignId, campaignId),
        eq(campaignMembers.userId, userId),
        isNull(campaigns.deletedAt)
      )
    )
    .limit(1);
  if (!row) error(404, serverT('server.campaignNotFound'));
  return row;
}

export async function requireRight(
  campaignId: string,
  userId: string,
  right: RightKey
): Promise<Membership> {
  const membership = await requireMembership(campaignId, userId);
  if (!may(membership.role, membership.campaign.rights, right))
    error(403, serverT('server.forbidden'));
  return membership;
}

export async function listCampaigns(userId: string): Promise<CampaignSummary[]> {
  const rows = await db
    .select({ campaign: campaigns, role: campaignMembers.role })
    .from(campaignMembers)
    .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
    .where(and(eq(campaignMembers.userId, userId), isNull(campaigns.deletedAt)))
    .orderBy(desc(campaigns.updatedAt));

  return Promise.all(
    rows.map(async ({ campaign, role }) => {
      const [[nodeTotal], [sessionTotal], memberRows] = await Promise.all([
        db
          .select({ value: count() })
          .from(nodes)
          .where(and(eq(nodes.campaignId, campaign.id), isNull(nodes.trashedAt))),
        db
          .select({ value: count() })
          .from(sessions)
          .where(and(eq(sessions.campaignId, campaign.id), isNull(sessions.trashedAt))),
        db
          .select({
            id: users.id,
            name: users.name,
            color: users.color,
            role: campaignMembers.role
          })
          .from(campaignMembers)
          .innerJoin(users, eq(users.id, campaignMembers.userId))
          .where(eq(campaignMembers.campaignId, campaign.id))
          .orderBy(asc(campaignMembers.joinedAt))
      ]);
      return {
        id: campaign.id,
        title: campaign.title,
        system: campaign.system,
        note: campaign.note,
        role,
        memberCount: memberRows.length,
        nodeCount: Number(nodeTotal?.value ?? 0),
        sessionCount: Number(sessionTotal?.value ?? 0),
        members: memberRows,
        updatedAt: campaign.updatedAt.toISOString()
      };
    })
  );
}

export async function createCampaign(
  user: SessionUser,
  input: { title: string; system: string; note: string }
): Promise<{ id: string }> {
  const id = await db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(campaigns)
      .values({ ...input, rights: DEFAULT_RIGHTS, createdBy: user.id })
      .returning({ id: campaigns.id });
    await tx
      .insert(campaignMembers)
      .values({ campaignId: campaign.id, userId: user.id, role: 'gm' });
    await tx.insert(nodeTypes).values(
      BUILTIN_NODE_TYPES.map((type) => ({
        campaignId: campaign.id,
        key: type.key,
        pluralName: type.nl,
        singularName: type.one,
        colorDark: type.colorDark,
        colorLight: type.colorLight,
        custom: false
      }))
    );
    await tx
      .insert(auditLog)
      .values({ campaignId: campaign.id, userId: user.id, action: 'campaign.created' });
    return campaign.id;
  });
  return { id };
}

export async function updateCampaign(
  campaignId: string,
  userId: string,
  values: Partial<{
    title: string;
    system: string;
    note: string;
    rights: Record<string, boolean>;
    forceSettings: ForceSettings;
    mapMediaId: string | null;
  }>
): Promise<void> {
  const onlyMap = Object.keys(values).every((key) => key === 'mapMediaId');
  const membership = await requireRight(campaignId, userId, onlyMap ? 'mapUpload' : 'settings');
  const rights = values.rights ? { ...membership.campaign.rights, ...values.rights } : undefined;
  await db
    .update(campaigns)
    .set({ ...values, rights, updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));
  await log(campaignId, userId, 'campaign.updated');
  await invalidateCampaign(campaignId, 'campaign');
}

export async function deleteCampaign(campaignId: string, userId: string): Promise<void> {
  const membership = await requireMembership(campaignId, userId);
  if (membership.role !== 'gm') error(403, serverT('server.deleteCampaignGmOnly'));
  const [gmCount] = await db
    .select({ value: count() })
    .from(campaignMembers)
    .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.role, 'gm')));
  if (Number(gmCount.value) < 1) error(409, serverT('server.campaignNeedsGm'));
  await db
    .update(campaigns)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));
  await log(campaignId, userId, 'campaign.deleted');
}

export async function getWorkspace(
  campaignId: string,
  viewer: SessionUser,
  viewAsId?: string | null
): Promise<WorkspaceSnapshot> {
  const actualMembership = await requireMembership(campaignId, viewer.id);
  const campaignRow = actualMembership.campaign;
  if (viewAsId && actualMembership.role !== 'gm') {
    error(403, serverT('server.viewAsGmOnly'));
  }
  const [
    memberRows,
    typeRows,
    nodeRows,
    linkRows,
    sessionRows,
    scratchRows,
    nodeNoteRows,
    postRows,
    mediaRows
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        color: users.color,
        role: campaignMembers.role
      })
      .from(campaignMembers)
      .innerJoin(users, eq(users.id, campaignMembers.userId))
      .where(eq(campaignMembers.campaignId, campaignId))
      .orderBy(asc(campaignMembers.joinedAt)),
    db
      .select()
      .from(nodeTypes)
      .where(eq(nodeTypes.campaignId, campaignId))
      .orderBy(asc(nodeTypes.pluralName)),
    db.select().from(nodes).where(eq(nodes.campaignId, campaignId)),
    db.select().from(links).where(eq(links.campaignId, campaignId)),
    db
      .select()
      .from(sessions)
      .where(eq(sessions.campaignId, campaignId))
      .orderBy(asc(sessions.sequence)),
    db
      .select()
      .from(sessionScratch)
      .innerJoin(sessions, eq(sessions.id, sessionScratch.sessionId))
      .where(and(eq(sessions.campaignId, campaignId), eq(sessionScratch.userId, viewer.id))),
    db
      .select({ nodeId: nodeDescriptions.nodeId, body: nodeDescriptions.body })
      .from(nodeDescriptions)
      .innerJoin(nodes, eq(nodes.id, nodeDescriptions.nodeId))
      .where(and(eq(nodes.campaignId, campaignId), eq(nodeDescriptions.userId, viewer.id))),
    db
      .select({ post: posts, name: users.name, color: users.color })
      .from(posts)
      .innerJoin(nodes, eq(nodes.id, posts.nodeId))
      .innerJoin(users, eq(users.id, posts.userId))
      .where(eq(nodes.campaignId, campaignId)),
    db.select().from(media).where(eq(media.campaignId, campaignId))
  ]);

  const requestedView =
    viewAsId && viewAsId !== viewer.id
      ? memberRows.find((member) => member.id === viewAsId)
      : undefined;
  if (viewAsId && viewAsId !== viewer.id && !requestedView) {
    error(404, serverT('server.playerNotFound'));
  }
  const viewAs = requestedView ?? null;
  const visibilityViewer = viewAs ?? viewer;
  const role = viewAs?.role ?? actualMembership.role;

  const visibleRows = nodeRows.filter((node) =>
    canSeeNode(
      { revealed: node.revealed, visibility: node.visibility, visibleWith: node.visibleWith },
      visibilityViewer,
      role,
      campaignRow.rights
    )
  );
  const visibleIds = new Set(visibleRows.map((node) => node.id));
  const notesByNode = new Map(
    nodeNoteRows.map((row) => [row.nodeId, normalizeBody(row.body)] as const)
  );

  const worldNodes: WorldNode[] = visibleRows.map((node) => ({
    id: node.id,
    type: node.typeKey,
    title: node.title,
    size: node.size,
    summary: node.summary,
    description: normalizeBody(node.description),
    note: notesByNode.get(node.id) ?? normalizeBody([]),
    revealed: node.revealed,
    visibility: node.visibility,
    visibleWith: node.visibleWith,
    x: node.x,
    y: node.y,
    pinned: node.pinned,
    pinX: node.pinX,
    pinY: node.pinY,
    pinMapId: node.pinMapId,
    markerLocked: node.markerLocked,
    imageMediaId: node.imageMediaId,
    mapMediaId: node.mapMediaId,
    tags: node.tags,
    stats: node.stats,
    gear: node.gear,
    trashedAt: node.trashedAt?.toISOString() ?? null,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString()
  }));

  const worldLinks: WorldLink[] = linkRows
    .filter((link) => visibleIds.has(link.sourceId) && visibleIds.has(link.targetId))
    .map((link) => ({
      id: link.id,
      sourceId: link.sourceId,
      targetId: link.targetId,
      relation: 'related_to',
      fromDescription: link.fromDescription,
      sourceNodeId: link.sourceNodeId
    }));

  const sessionEntries: SessionEntry[] = sessionRows.map((session) => ({
    id: session.id,
    title: session.title,
    sequence: session.sequence,
    worldDate: session.worldDate,
    body: normalizeBody(session.body),
    trashedAt: session.trashedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  }));

  const scratch: SessionScratch[] = scratchRows.map(({ session_scratch: row }) => ({
    sessionId: row.sessionId,
    userId: row.userId,
    body: normalizeBody(row.body)
  }));

  const visiblePosts: NodePost[] = postRows
    .filter(({ post }) => {
      if (!visibleIds.has(post.nodeId)) return false;
      if (role === 'gm' || post.userId === viewer.id) return true;
      if (post.visibility === 'all') return true;
      if (post.visibility === 'sel') return post.visibleWith.includes(visibilityViewer.id);
      if (post.visibility === 'gm') return campaignRow.rights.dmNotes;
      return false;
    })
    .map(({ post, name, color }) => ({
      id: post.id,
      nodeId: post.nodeId,
      by: post.userId,
      byName: name,
      byColor: color,
      kind: post.kind,
      visibility: post.visibility,
      visibleWith: post.visibleWith,
      text: post.text,
      createdAt: post.createdAt.toISOString()
    }));

  const members: CampaignMember[] = memberRows;
  const campaign: Campaign = {
    id: campaignRow.id,
    title: campaignRow.title,
    system: campaignRow.system,
    note: campaignRow.note,
    role,
    rights: campaignRow.rights,
    forceSettings: campaignRow.forceSettings,
    mapMediaId: campaignRow.mapMediaId,
    members: memberRows.map(({ id, name, color, role: memberRole }) => ({
      id,
      name,
      color,
      role: memberRole
    })),
    updatedAt: campaignRow.updatedAt.toISOString()
  };

  const allowedMedia = new Set<string>(
    [
      campaignRow.mapMediaId,
      ...visibleRows.flatMap((node) => [node.imageMediaId, node.mapMediaId])
    ].filter((id): id is string => !!id)
  );

  return {
    campaign,
    currentUser: viewer,
    viewAs,
    canViewAs: actualMembership.role === 'gm',
    members,
    nodeTypes: typeRows.map((type) => ({
      key: type.key,
      nl: type.pluralName,
      one: type.singularName,
      colorDark: type.colorDark,
      colorLight: type.colorLight,
      custom: type.custom
    })),
    nodes: worldNodes,
    links: worldLinks,
    sessions: sessionEntries,
    scratch,
    posts: visiblePosts,
    media: mediaRows
      .filter((item) => allowedMedia.has(item.id) || item.uploadedBy === viewer.id)
      .map((item) => ({
        id: item.id,
        name: item.originalName,
        mimeType: item.mimeType,
        size: item.size,
        url: `/api/media/${item.id}`
      }))
  };
}

export async function inviteMember(
  campaignId: string,
  userId: string,
  input: { email: string; name: string; role: 'gm' | 'player' }
): Promise<{ token: string; invitationId: string }> {
  await requireRight(campaignId, userId, 'invite');
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, input.email.toLowerCase()))
    .limit(1);
  if (existing[0]) {
    await db
      .insert(campaignMembers)
      .values({ campaignId, userId: existing[0].id, role: input.role })
      .onConflictDoNothing();
  }
  const token = randomBytes(32).toString('base64url');
  const normalizedEmail = input.email.toLowerCase();
  const [pending] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.campaignId, campaignId),
        eq(sql`lower(${invitations.email})`, normalizedEmail),
        isNull(invitations.acceptedAt)
      )
    )
    .limit(1);
  const [invitation] = pending
    ? await db
        .update(invitations)
        .set({
          name: input.name,
          role: input.role,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 14 * 86_400_000)
        })
        .where(eq(invitations.id, pending.id))
        .returning({ id: invitations.id })
    : await db
        .insert(invitations)
        .values({
          campaignId,
          email: normalizedEmail,
          name: input.name,
          role: input.role,
          tokenHash: hashToken(token),
          invitedBy: userId,
          expiresAt: new Date(Date.now() + 14 * 86_400_000),
          acceptedAt: existing[0] ? new Date() : null
        })
        .returning({ id: invitations.id });
  await log(campaignId, userId, 'member.invited', 'invitation', invitation.id, {
    email: input.email
  });
  return { token, invitationId: invitation.id };
}

export async function acceptInvitation(userId: string, token: string): Promise<string> {
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, hashToken(token)),
        isNull(invitations.acceptedAt),
        sql`${invitations.expiresAt} > now()`
      )
    )
    .limit(1);
  if (!invitation) error(404, serverT('server.invitationExpired'));
  await db.transaction(async (tx) => {
    await tx
      .insert(campaignMembers)
      .values({ campaignId: invitation.campaignId, userId, role: invitation.role })
      .onConflictDoUpdate({
        target: [campaignMembers.campaignId, campaignMembers.userId],
        set: { role: invitation.role }
      });
    await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));
  });
  return invitation.campaignId;
}

export async function updateMemberRole(
  campaignId: string,
  actingUserId: string,
  targetUserId: string,
  role: 'gm' | 'player'
): Promise<void> {
  const membership = await requireMembership(campaignId, actingUserId);
  if (membership.role !== 'gm') error(403, serverT('server.rolesGmOnly'));
  if (actingUserId === targetUserId && role === 'player') {
    const [total] = await db
      .select({ value: count() })
      .from(campaignMembers)
      .where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.role, 'gm')));
    if (Number(total.value) <= 1) error(409, serverT('server.promoteOtherGm'));
  }
  await db
    .update(campaignMembers)
    .set({ role })
    .where(
      and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, targetUserId))
    );
  await log(campaignId, actingUserId, 'member.role_updated', 'user', targetUserId, { role });
}

export async function removeMember(
  campaignId: string,
  actingUserId: string,
  targetUserId: string
): Promise<void> {
  const membership = await requireMembership(campaignId, actingUserId);
  if (membership.role !== 'gm' && actingUserId !== targetUserId)
    error(403, serverT('server.cannotRemovePlayer'));
  await db
    .delete(campaignMembers)
    .where(
      and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, targetUserId))
    );
  await log(campaignId, actingUserId, 'member.removed', 'user', targetUserId);
}

export async function log(
  campaignId: string | null,
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata: Record<string, unknown> = {}
) {
  await db.insert(auditLog).values({ campaignId, userId, action, entityType, entityId, metadata });
}
