import { describe, expect, it } from 'vitest';
import { diffWords } from './diff';

describe('versieverschillen', () => {
  it('markeert toegevoegde en verwijderde woorden', () => {
    const result = diffWords('de oude eed', 'de nieuwe eed');
    expect(result).toEqual([
      { value: 'de', kind: 'same' },
      { value: 'oude', kind: 'removed' },
      { value: 'nieuwe', kind: 'added' },
      { value: 'eed', kind: 'same' }
    ]);
  });

  it('slaat extreem lange vergelijkingen veilig over', () => {
    expect(diffWords('a '.repeat(1_000), 'b '.repeat(1_000), 100)).toBeNull();
  });
});
