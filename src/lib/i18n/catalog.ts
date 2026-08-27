import nl from './locales/nl.yaml';
import en from './locales/en.yaml';

export const SUPPORTED_LOCALES = ['nl', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export type SnippetValues = Record<string, string | number | boolean>;
export type SnippetCatalog = Record<string, unknown>;

export const catalogs: Record<Locale, SnippetCatalog> = { nl, en };

export function translate(locale: Locale, key: string, values: SnippetValues = {}): string {
  const translated = readSnippet(catalogs[locale], key);
  const fallback = readSnippet(catalogs[DEFAULT_LOCALE], key);
  const template = translated ?? fallback ?? key;
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : `{{${name}}}`
  );
}

export function hasTranslation(key: string, locale: Locale): boolean {
  return readSnippet(catalogs[locale], key) !== undefined;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

function readSnippet(dictionary: SnippetCatalog, key: string): string | undefined {
  let value: unknown = dictionary;
  for (const part of key.split('.')) {
    if (!value || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' ? value : undefined;
}
