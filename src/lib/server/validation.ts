import { z } from 'zod';

const segment = z.discriminatedUnion('t', [
  z.object({ t: z.literal('txt'), v: z.string().max(100_000) }),
  z.object({ t: z.literal('ref'), id: z.uuid() })
]);

export const bodySchema = z
  .array(z.object({ segs: z.array(segment).max(2_000) }))
  .max(2_000)
  .default([{ segs: [{ t: 'txt' as const, v: '' }] }]);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  password: z.string().min(10).max(200)
});

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200)
});

export const forgotSchema = z.object({ email: z.email().max(254) });
export const resetSchema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(10).max(200)
});

export const campaignCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  system: z.string().trim().min(2).max(80),
  note: z.string().trim().max(300).default('')
});

export const campaignUpdateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  system: z.string().trim().min(2).max(80).optional(),
  note: z.string().trim().max(300).optional(),
  rights: z.record(z.string(), z.boolean()).optional(),
  mapMediaId: z.uuid().nullable().optional()
});

export const nodeCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  size: z.enum(['s', 'm', 'l']).default('m'),
  summary: z.string().trim().max(500).default(''),
  revealed: z.boolean().default(true),
  visibility: z.enum(['all', 'sel', 'me']).default('all'),
  visibleWith: z.array(z.uuid()).max(100).default([]),
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  connectTo: z.array(z.uuid()).max(100).default([])
});

export const nodeUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  type: z
    .string()
    .regex(/^[a-z0-9_-]{1,40}$/)
    .optional(),
  size: z.enum(['s', 'm', 'l']).optional(),
  summary: z.string().trim().max(500).optional(),
  revealed: z.boolean().optional(),
  visibility: z.enum(['all', 'sel', 'me']).optional(),
  visibleWith: z.array(z.uuid()).max(100).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  pinned: z.boolean().optional(),
  pinX: z.number().min(0).max(1).nullable().optional(),
  pinY: z.number().min(0).max(1).nullable().optional(),
  pinMapId: z.uuid().nullable().optional(),
  markerLocked: z.boolean().optional(),
  imageMediaId: z.uuid().nullable().optional(),
  mapMediaId: z.uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
  stats: z.record(z.string(), z.string().max(100)).optional(),
  gear: z
    .array(z.object({ name: z.string().max(100), note: z.string().max(300) }))
    .max(100)
    .optional(),
  trashed: z.boolean().optional()
});

export const descriptionSchema = z.object({ body: bodySchema, shared: z.boolean() });

export const linkSchema = z.object({ sourceId: z.uuid(), targetId: z.uuid() });

export const sessionCreateSchema = z.object({
  title: z.string().trim().min(1).max(180),
  worldDate: z.string().trim().max(120).default(''),
  body: bodySchema.optional()
});

export const sessionUpdateSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  worldDate: z.string().trim().max(120).optional(),
  body: bodySchema.optional(),
  trashed: z.boolean().optional()
});

export const scratchSchema = z.object({ body: bodySchema });
export const postSchema = z.object({
  nodeId: z.uuid(),
  kind: z.enum(['note', 'theory', 'goal']),
  visibility: z.enum(['all', 'me', 'gm', 'sel']),
  visibleWith: z.array(z.uuid()).max(100).default([]),
  text: z.string().trim().min(1).max(5_000)
});

export const inviteSchema = z.object({
  email: z.email().max(254),
  name: z.string().trim().max(80).default(''),
  role: z.enum(['gm', 'player']).default('player')
});

export const nodeTypeSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  pluralName: z.string().trim().min(2).max(50),
  singularName: z.string().trim().min(2).max(50),
  colorDark: z.string().regex(/^#[0-9a-f]{6}$/i),
  colorLight: z.string().regex(/^#[0-9a-f]{6}$/i)
});
