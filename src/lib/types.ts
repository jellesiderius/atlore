export type Id = string;
export type NodeSize = 's' | 'm' | 'l';
export type Visibility = 'all' | 'sel' | 'me';
export type Role = 'gm' | 'player';
export type ViewName = 'graph' | 'session' | 'story' | 'atlas';
export type PanelName = 'explorer' | 'recent' | 'search' | 'settings';
export type NodeDossierTab = 'overview' | 'map' | 'game' | 'relations' | 'story';
export type CampaignSettingsTab = 'general' | 'members' | 'rights';
export type PostKind = 'note' | 'theory' | 'goal';
export type PostVisibility = 'all' | 'me' | 'gm' | 'sel';

export interface TextSegment {
  t: 'txt';
  v: string;
}

export interface ReferenceSegment {
  t: 'ref';
  id: Id;
}

export type Segment = TextSegment | ReferenceSegment;
export interface Paragraph {
  segs: Segment[];
}

export interface SessionUser {
  id: Id;
  name: string;
  email: string;
  color: string;
}

export interface CampaignMember extends SessionUser {
  role: Role;
}

export interface Rights {
  create: boolean;
  edit: boolean;
  link: boolean;
  delete: boolean;
  image: boolean;
  write: boolean;
  session: boolean;
  history: boolean;
  mapUpload: boolean;
  pin: boolean;
  reveal: boolean;
  seeSecret: boolean;
  dmNotes: boolean;
  invite: boolean;
  settings: boolean;
}

export type RightKey = keyof Rights;

export interface CampaignSummary {
  id: Id;
  title: string;
  system: string;
  note: string;
  role: Role;
  memberCount: number;
  nodeCount: number;
  sessionCount: number;
  members: Pick<CampaignMember, 'id' | 'name' | 'color' | 'role'>[];
  updatedAt: string;
}

export interface Campaign extends Omit<
  CampaignSummary,
  'memberCount' | 'nodeCount' | 'sessionCount'
> {
  rights: Rights;
  mapMediaId: Id | null;
}

export interface NodeType {
  key: string;
  nl: string;
  one: string;
  colorDark: string;
  colorLight: string;
  custom: boolean;
}

export interface GearItem {
  name: string;
  note: string;
}

export interface WorldNode {
  id: Id;
  type: string;
  title: string;
  size: NodeSize;
  summary: string;
  description: Paragraph[];
  note: Paragraph[];
  revealed: boolean;
  visibility: Visibility;
  visibleWith: Id[];
  x: number;
  y: number;
  pinned: boolean;
  pinX: number | null;
  pinY: number | null;
  pinMapId: Id | null;
  markerLocked: boolean;
  imageMediaId: Id | null;
  mapMediaId: Id | null;
  tags: string[];
  stats: Record<string, string>;
  gear: GearItem[];
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorldLink {
  id: Id;
  sourceId: Id;
  targetId: Id;
  relation: 'related_to';
  fromDescription: boolean;
  sourceNodeId: Id | null;
}

export interface SessionEntry {
  id: Id;
  title: string;
  sequence: number;
  worldDate: string;
  body: Paragraph[];
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionScratch {
  sessionId: Id;
  userId: Id;
  body: Paragraph[];
}

export interface NodePost {
  id: Id;
  nodeId: Id;
  by: Id;
  byName: string;
  byColor: string;
  kind: PostKind;
  visibility: PostVisibility;
  visibleWith: Id[];
  text: string;
  createdAt: string;
}

export interface MediaAsset {
  id: Id;
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface VersionEntry {
  id: Id;
  entityType: 'node' | 'session';
  entityId: Id;
  byName: string;
  snapshot: {
    title: string;
    summary?: string;
    worldDate?: string;
    body: Paragraph[];
  };
  createdAt: string;
}

export interface WorkspaceSnapshot {
  campaign: Campaign;
  currentUser: SessionUser;
  viewAs: CampaignMember | null;
  canViewAs: boolean;
  members: CampaignMember[];
  nodeTypes: NodeType[];
  nodes: WorldNode[];
  links: WorldLink[];
  sessions: SessionEntry[];
  scratch: SessionScratch[];
  posts: NodePost[];
  media: MediaAsset[];
}

export interface SearchContext {
  sessionNodeIds?: Set<Id>;
  recentIds?: Id[];
  selectedId?: Id | null;
  degree?: Map<Id, number>;
  limit?: number;
  exclude?: Set<Id>;
}
