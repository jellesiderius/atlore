import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestEvent } from '@sveltejs/kit';
import { isLocale, translate, type Locale, type SnippetValues } from './catalog';

const requestLocale = new AsyncLocalStorage<Locale>();

export function localeFromEvent(event: Pick<RequestEvent, 'cookies'>): Locale {
  const locale = event.cookies.get('atlore_locale');
  return isLocale(locale) ? locale : 'nl';
}

export function withRequestLocale<T>(event: Pick<RequestEvent, 'cookies'>, run: () => T): T {
  return requestLocale.run(localeFromEvent(event), run);
}

export function serverT(key: string, values: SnippetValues = {}): string {
  return translate(requestLocale.getStore() ?? 'nl', key, values);
}
