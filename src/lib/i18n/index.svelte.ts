import { browser } from '$app/environment';
import {
  DEFAULT_LOCALE,
  hasTranslation,
  isLocale,
  translate,
  type Locale,
  type SnippetValues
} from './catalog';

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, type SnippetValues } from './catalog';
const STORAGE_KEY = 'atlore_locale';
const COOKIE_NAME = 'atlore_locale';
let activeLocale = $state<Locale>(DEFAULT_LOCALE);
let initialized = false;

export const i18n = {
  get locale(): Locale {
    return activeLocale;
  },
  set locale(locale: Locale) {
    setLocale(locale);
  }
};

export function initializeLocale(): void {
  if (!browser || initialized) return;
  initialized = true;
  const stored = localStorage.getItem(STORAGE_KEY);
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`))
    ?.split('=')[1];
  const locale = isLocale(stored) ? stored : isLocale(cookie) ? cookie : DEFAULT_LOCALE;
  applyLocale(locale, false);
}

export function setLocale(locale: Locale): void {
  applyLocale(locale, true);
}

export function t(key: string, values: SnippetValues = {}): string {
  return translate(activeLocale, key, values);
}

export function hasSnippet(key: string, locale: Locale = activeLocale): boolean {
  return hasTranslation(key, locale);
}

export function nodeTypeLabel(
  type: { key: string; nl: string; one: string },
  form: 'plural' | 'singular' = 'plural'
): string {
  const key = `nodeTypes.${type.key}.${form}`;
  if (hasSnippet(key)) return t(key);
  return form === 'plural' ? type.nl : type.one;
}

function applyLocale(locale: Locale, persist: boolean): void {
  activeLocale = locale;
  if (!browser) return;
  document.documentElement.lang = locale;
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = t('meta.description');
  if (!persist) return;
  localStorage.setItem(STORAGE_KEY, locale);
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
