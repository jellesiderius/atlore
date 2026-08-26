import { describe, expect, it } from 'vitest';
import { createClientId } from './id';

describe('createClientId', () => {
  it('gebruikt randomUUID wanneer de browser dit ondersteunt', () => {
    expect(createClientId({ randomUUID: () => 'native-id' })).toBe('native-id');
  });

  it('maakt een RFC 4122 v4 UUID met getRandomValues als fallback', () => {
    const id = createClientId({
      getRandomValues(values) {
        values.fill(17);
        return values;
      }
    });
    expect(id).toMatch(/^11111111-1111-4111-9111-111111111111$/);
  });

  it('kan ook zonder Web Crypto een uniek lokaal UI-id maken', () => {
    expect(createClientId(null)).not.toBe(createClientId(null));
  });
});
