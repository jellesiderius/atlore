import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { catalogs, translate, type SnippetCatalog } from './catalog';

function paths(value: SnippetCatalog, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'string' ? [path] : paths(child as SnippetCatalog, path);
  });
}

function read(value: SnippetCatalog, path: string): string {
  return path
    .split('.')
    .reduce<unknown>((current, part) => (current as SnippetCatalog)[part], value) as string;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.svelte', '.ts'].includes(extname(path)) && !path.endsWith('.test.ts') ? [path] : [];
  });
}

describe('translation snippets', () => {
  it('houdt de Nederlandse en Engelse YML-catalogi gelijk', () => {
    expect(paths(catalogs.en).sort()).toEqual(paths(catalogs.nl).sort());
  });

  it('houdt interpolatievelden gelijk tussen beide talen', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((match) => match[1]).sort();
    for (const path of paths(catalogs.nl)) {
      expect(placeholders(read(catalogs.en, path)), path).toEqual(
        placeholders(read(catalogs.nl, path))
      );
    }
  });

  it('bevat iedere statisch gebruikte snippetsleutel', () => {
    const keys = sourceFiles(join(process.cwd(), 'src'))
      .flatMap((file) => [
        ...readFileSync(file, 'utf8').matchAll(/\b(?:serverT|t)\(['"]([^'"]+)['"]/g)
      ])
      .map((match) => match[1]);

    for (const key of new Set(keys)) {
      expect(paths(catalogs.nl), key).toContain(key);
    }
  });

  it('vervangt benoemde waarden', () => {
    expect(translate('en', 'workspace.readonlyAs', { name: 'Lena' })).toBe(
      'Read-only: you are viewing the world as Lena.'
    );
  });

  it('valt veilig terug op de sleutel wanneer een snippet ontbreekt', () => {
    expect(translate('nl', 'missing.snippet')).toBe('missing.snippet');
  });
});
