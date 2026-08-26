import { describe, expect, it } from 'vitest';
import { bodyToText, normalizeBody, referencedNodeIds } from './text';

describe('rich-textmodel', () => {
  it('normaliseert legacy text-segmenten', () => {
    const body = normalizeBody([
      {
        segs: [
          { t: 'text', v: 'Hallo ' },
          { t: 'ref', id: 'node-1' }
        ]
      }
    ]);
    expect(body[0].segs[0]).toEqual({ t: 'txt', v: 'Hallo ' });
    expect(referencedNodeIds(body)).toEqual(new Set(['node-1']));
    expect(bodyToText(body, () => 'Mira')).toBe('Hallo Mira');
  });

  it('levert altijd minstens één paragraaf', () => {
    expect(normalizeBody([])).toEqual([{ segs: [{ t: 'txt', v: '' }] }]);
  });
});
