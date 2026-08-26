import { describe, expect, it } from 'vitest';
import { bodyToText, findNodeTitleMatches, normalizeBody, referencedNodeIds } from './text';

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

  it('vindt alle volledige nodenamen in hetzelfde tekstblok', () => {
    const matches = findNodeTitleMatches(
      'jan en kees en kare en bertje\nToen jan2 jan2 en jan janjan\njan klaas kees',
      [
        { id: 'jan', title: 'Jan' },
        { id: 'kees', title: 'Kees' },
        { id: 'kare', title: 'Kare' },
        { id: 'bertje', title: 'Bertje' },
        { id: 'klaas', title: 'Klaas' }
      ]
    );

    expect(matches.map((match) => match.id)).toEqual([
      'jan',
      'kees',
      'kare',
      'bertje',
      'jan',
      'jan',
      'klaas',
      'kees'
    ]);
  });

  it('kiest de langste naam bij overlappende nodenamen', () => {
    const matches = findNodeTitleMatches('Jan Klaas spreekt Jan.', [
      { id: 'jan', title: 'Jan' },
      { id: 'jan-klaas', title: 'Jan Klaas' }
    ]);

    expect(matches.map(({ id, start, end }) => ({ id, start, end }))).toEqual([
      { id: 'jan-klaas', start: 0, end: 9 },
      { id: 'jan', start: 18, end: 21 }
    ]);
  });
});
