import { describe, expect, it } from 'vitest';
import { ensureUploadBodySizeLimit } from '../../../server/upload-limits.js';

describe('upload request body limit', () => {
  it('raises adapter-node above Atlore’s default image limit', () => {
    const environment: Record<string, string | undefined> = {};

    expect(ensureUploadBodySizeLimit(environment)).toBe(String(13 * 1_048_576));
    expect(environment.BODY_SIZE_LIMIT).toBe(String(13 * 1_048_576));
  });

  it('tracks a custom self-hosted upload limit', () => {
    const environment = { MAX_UPLOAD_MB: '24.5', BODY_SIZE_LIMIT: '512K' };

    expect(ensureUploadBodySizeLimit(environment)).toBe(String(25.5 * 1_048_576));
  });

  it('keeps larger and unlimited operator settings intact', () => {
    expect(ensureUploadBodySizeLimit({ MAX_UPLOAD_MB: '12', BODY_SIZE_LIMIT: '32M' })).toBe('32M');
    expect(ensureUploadBodySizeLimit({ MAX_UPLOAD_MB: '12', BODY_SIZE_LIMIT: 'Infinity' })).toBe(
      'Infinity'
    );
  });
});
