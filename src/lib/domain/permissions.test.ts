import { describe, expect, it } from 'vitest';
import { DEFAULT_RIGHTS } from './constants';
import { canSeeNode, may } from './permissions';

describe('campagne-ACL', () => {
  const viewer = { id: 'speler-1' };

  it('laat de spelleider altijd alles zien', () => {
    expect(
      canSeeNode(
        { revealed: false, visibility: 'me', visibleWith: [] },
        viewer,
        'gm',
        DEFAULT_RIGHTS
      )
    ).toBe(true);
  });

  it('lekt verborgen of selectieve nodes niet naar spelers', () => {
    expect(
      canSeeNode(
        { revealed: false, visibility: 'all', visibleWith: [] },
        viewer,
        'player',
        DEFAULT_RIGHTS
      )
    ).toBe(false);
    expect(
      canSeeNode(
        { revealed: true, visibility: 'sel', visibleWith: ['speler-2'] },
        viewer,
        'player',
        DEFAULT_RIGHTS
      )
    ).toBe(false);
    expect(
      canSeeNode(
        { revealed: true, visibility: 'sel', visibleWith: ['speler-1'] },
        viewer,
        'player',
        DEFAULT_RIGHTS
      )
    ).toBe(true);
  });

  it('past rechten alleen op spelers toe', () => {
    expect(may('gm', DEFAULT_RIGHTS, 'delete')).toBe(true);
    expect(may('player', DEFAULT_RIGHTS, 'delete')).toBe(false);
  });
});
