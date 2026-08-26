import type { Paragraph, Segment } from '$lib/types';

export const EMPTY_BODY: Paragraph[] = [{ segs: [{ t: 'txt', v: '' }] }];

export function normalizeBody(value: unknown): Paragraph[] {
  if (!Array.isArray(value)) return structuredClone(EMPTY_BODY);
  const paragraphs = value
    .filter(
      (paragraph): paragraph is { segs?: unknown } => !!paragraph && typeof paragraph === 'object'
    )
    .map((paragraph) => ({
      segs: Array.isArray(paragraph.segs)
        ? paragraph.segs.flatMap((raw): Segment[] => {
            if (!raw || typeof raw !== 'object') return [];
            const segment = raw as Record<string, unknown>;
            if ((segment.t === 'txt' || segment.t === 'text') && typeof segment.v === 'string') {
              return [{ t: 'txt', v: segment.v }];
            }
            if (segment.t === 'ref' && typeof segment.id === 'string') {
              return [{ t: 'ref', id: segment.id }];
            }
            return [];
          })
        : []
    }))
    .filter((paragraph) => paragraph.segs.length > 0);
  return paragraphs.length ? paragraphs : structuredClone(EMPTY_BODY);
}

export function bodyToText(body: Paragraph[], titleForId?: (id: string) => string): string {
  return body
    .map((paragraph) =>
      paragraph.segs
        .map((segment) =>
          segment.t === 'txt' ? segment.v : (titleForId?.(segment.id) ?? `@${segment.id}`)
        )
        .join('')
    )
    .join('\n\n');
}

export function referencedNodeIds(body: Paragraph[]): Set<string> {
  const ids = new Set<string>();
  for (const paragraph of body) {
    for (const segment of paragraph.segs) if (segment.t === 'ref') ids.add(segment.id);
  }
  return ids;
}

export function bodyWordCount(body: Paragraph[]): number {
  return bodyToText(body).trim().split(/\s+/u).filter(Boolean).length;
}
