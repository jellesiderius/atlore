import type { CampaignMember, RightKey, Rights, SessionUser, WorldNode } from '$lib/types';

export function canSeeNode(
  node: Pick<WorldNode, 'revealed' | 'visibility' | 'visibleWith'>,
  viewer: Pick<SessionUser, 'id'>,
  role: CampaignMember['role'],
  rights: Rights
): boolean {
  if (role === 'gm' || rights.seeSecret) return true;
  if (!node.revealed) return false;
  if (node.visibility === 'me') return false;
  if (node.visibility === 'sel') return node.visibleWith.includes(viewer.id);
  return true;
}

export function may(role: CampaignMember['role'], rights: Rights, right: RightKey): boolean {
  return role === 'gm' || rights[right];
}
