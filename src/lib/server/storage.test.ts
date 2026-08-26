import { sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeLocalPath } from './storage';

describe('local storage keys', () => {
  it('accepts generated media keys with a file extension', () => {
    const target = safeLocalPath(
      'ad72babe-bb71-46be-992f-bbd4a4bf073c/86e26c8f-270e-440f-8e5d-f4009707cff7.png'
    );

    expect(target).toContain(
      `${sep}ad72babe-bb71-46be-992f-bbd4a4bf073c${sep}86e26c8f-270e-440f-8e5d-f4009707cff7.png`
    );
  });

  it.each(['../secret', 'campaign/../secret', '/absolute.png', 'campaign//map.png'])(
    'rejects unsafe key %s',
    (key) => {
      expect(() => safeLocalPath(key)).toThrow('Ongeldige storage key.');
    }
  );
});
