import type { SearchContext, WorldNode } from '$lib/types';

export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl')
    .trim();
}

export function searchNodes(
  nodes: WorldNode[],
  query: string,
  context: SearchContext = {}
): WorldNode[] {
  const q = fold(query);
  const terms = q.split(/\s+/u).filter(Boolean);
  if (!terms.length) return [];
  const recent = context.recentIds ?? [];

  return nodes
    .filter((node) => !node.trashedAt && node.type !== 'session' && !context.exclude?.has(node.id))
    .map((node) => {
      const title = fold(node.title);
      const words = title.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      if (
        !terms.every((term) => title.includes(term) || words.some((word) => word.startsWith(term)))
      ) {
        return { node, score: -1 };
      }
      let score = 0;
      for (const term of terms) {
        score += words.filter((word) => word.startsWith(term)).length * 3;
        if (title.includes(term)) score += 1;
      }
      if (title.startsWith(q)) score += 4;
      if (context.sessionNodeIds?.has(node.id)) score += 2.5;
      const recentIndex = recent.indexOf(node.id);
      if (recentIndex >= 0) score += 2 * (1 - recentIndex / Math.max(1, recent.length));
      if (context.selectedId === node.id) score += 1.5;
      score += Math.min(1.2, Math.sqrt(context.degree?.get(node.id) ?? 0) * 0.25);
      return { node, score };
    })
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title, 'nl'))
    .slice(0, context.limit ?? 8)
    .map(({ node }) => node);
}
