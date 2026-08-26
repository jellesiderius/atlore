import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';
import type { GearItem, Paragraph, Rights } from '$lib/types';

export const campaignRole = pgEnum('campaign_role', ['gm', 'player']);
export const nodeSize = pgEnum('node_size', ['s', 'm', 'l']);
export const visibility = pgEnum('visibility', ['all', 'sel', 'me']);
export const postKind = pgEnum('post_kind', ['note', 'theory', 'goal']);
export const postVisibility = pgEnum('post_visibility', ['all', 'me', 'gm', 'sel']);
export const versionEntity = pgEnum('version_entity', ['node', 'session']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#f0913f'),
    passwordHash: text('password_hash').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex('users_email_lower_idx').on(sql`lower(${table.email})`)]
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('auth_sessions_user_idx').on(table.userId),
    index('auth_sessions_expiry_idx').on(table.expiresAt)
  ]
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('password_reset_user_idx').on(table.userId)]
);

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  system: text('system').notNull(),
  note: text('note').notNull().default(''),
  rights: jsonb('rights').$type<Rights>().notNull(),
  mapMediaId: uuid('map_media_id'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export const campaignMembers = pgTable(
  'campaign_members',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: campaignRole('role').notNull().default('player'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.campaignId, table.userId] }),
    index('campaign_members_user_idx').on(table.userId)
  ]
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    name: text('name').notNull().default(''),
    role: campaignRole('role').notNull().default('player'),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('invitations_campaign_idx').on(table.campaignId),
    uniqueIndex('invitations_pending_email_idx')
      .on(table.campaignId, table.email)
      .where(sql`${table.acceptedAt} is null`)
  ]
);

export const nodeTypes = pgTable(
  'node_types',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    pluralName: text('plural_name').notNull(),
    singularName: text('singular_name').notNull(),
    colorDark: text('color_dark').notNull(),
    colorLight: text('color_light').notNull(),
    custom: boolean('custom').notNull().default(false)
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.key] })]
);

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    storageKey: text('storage_key').notNull().unique(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('media_campaign_idx').on(table.campaignId)]
);

export const nodes = pgTable(
  'nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    typeKey: text('type_key').notNull(),
    title: text('title').notNull(),
    size: nodeSize('size').notNull().default('m'),
    summary: text('summary').notNull().default(''),
    description: jsonb('description').$type<Paragraph[]>().notNull().default([]),
    descriptionPlainText: text('description_plain_text').notNull().default(''),
    revealed: boolean('revealed').notNull().default(true),
    visibility: visibility('visibility').notNull().default('all'),
    visibleWith: uuid('visible_with')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    x: real('x').notNull().default(0),
    y: real('y').notNull().default(0),
    pinned: boolean('pinned').notNull().default(false),
    pinX: real('pin_x'),
    pinY: real('pin_y'),
    pinMapId: uuid('pin_map_id'),
    markerLocked: boolean('marker_locked').notNull().default(false),
    imageMediaId: uuid('image_media_id').references(() => media.id, { onDelete: 'set null' }),
    mapMediaId: uuid('map_media_id').references(() => media.id, { onDelete: 'set null' }),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    stats: jsonb('stats').$type<Record<string, string>>().notNull().default({}),
    gear: jsonb('gear').$type<GearItem[]>().notNull().default([]),
    trashedAt: timestamp('trashed_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('nodes_campaign_idx').on(table.campaignId),
    index('nodes_campaign_type_idx').on(table.campaignId, table.typeKey),
    uniqueIndex('nodes_campaign_title_idx')
      .on(table.campaignId, sql`lower(${table.title})`)
      .where(sql`${table.trashedAt} is null`)
  ]
);

export const nodeDescriptions = pgTable(
  'node_descriptions',
  {
    nodeId: uuid('node_id')
      .notNull()
      .references(() => nodes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: jsonb('body').$type<Paragraph[]>().notNull().default([]),
    plainText: text('plain_text').notNull().default(''),
    shared: boolean('shared').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.nodeId, table.userId] }),
    index('node_descriptions_user_idx').on(table.userId)
  ]
);

export const links = pgTable(
  'links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => nodes.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => nodes.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull().default('related_to'),
    fromDescription: boolean('from_description').notNull().default(false),
    sourceNodeId: uuid('source_node_id'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('links_campaign_idx').on(table.campaignId),
    index('links_source_idx').on(table.sourceId),
    index('links_target_idx').on(table.targetId),
    uniqueIndex('links_unique_pair_idx').on(table.campaignId, table.sourceId, table.targetId)
  ]
);

export const mutedAutoLinks = pgTable(
  'muted_auto_links',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => nodes.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id')
      .notNull()
      .references(() => nodes.id, { onDelete: 'cascade' })
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.sourceId, table.targetId] })]
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    sequence: integer('sequence').notNull(),
    worldDate: text('world_date').notNull().default(''),
    body: jsonb('body').$type<Paragraph[]>().notNull().default([]),
    plainText: text('plain_text').notNull().default(''),
    trashedAt: timestamp('trashed_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('sessions_campaign_idx').on(table.campaignId),
    uniqueIndex('sessions_sequence_idx').on(table.campaignId, table.sequence)
  ]
);

export const sessionScratch = pgTable(
  'session_scratch',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: jsonb('body').$type<Paragraph[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.userId] })]
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => nodes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: postKind('kind').notNull().default('note'),
    visibility: postVisibility('visibility').notNull().default('me'),
    visibleWith: uuid('visible_with')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('posts_node_idx').on(table.nodeId), index('posts_user_idx').on(table.userId)]
);

export const versions = pgTable(
  'versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    entityType: versionEntity('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    byUserId: uuid('by_user_id')
      .notNull()
      .references(() => users.id),
    byName: text('by_name').notNull(),
    snapshot: jsonb('snapshot')
      .$type<{ title: string; summary?: string; worldDate?: string; body: Paragraph[] }>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('versions_entity_idx').on(
      table.campaignId,
      table.entityType,
      table.entityId,
      table.createdAt
    )
  ]
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('audit_campaign_idx').on(table.campaignId, table.createdAt)]
);
