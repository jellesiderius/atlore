import { describe, expect, it } from 'vitest';
import { parseChangelog } from './changelog';

describe('parseChangelog', () => {
  it('returns released notes without the Unreleased section or Markdown decoration', () => {
    const releases = parseChangelog(`# Changelog

## [Unreleased]

### Added

- Work that is not public yet.

## [1.1.0] - 2026-08-27

### Added

- A \`version\` badge and [documentation](https://example.com).
`);

    expect(releases).toEqual([
      {
        version: '1.1.0',
        date: '2026-08-27',
        groups: [
          {
            title: 'Added',
            items: ['A version badge and documentation.']
          }
        ]
      }
    ]);
  });
});
