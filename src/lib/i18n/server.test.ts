import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { localeFromEvent, serverT, withRequestLocale } from './server';

function event(locale: string): Pick<RequestEvent, 'cookies'> {
  return {
    cookies: { get: () => locale } as unknown as RequestEvent['cookies']
  };
}

describe('server translations', () => {
  it('gebruikt Engels wanneer een request geen geldige taalkeuze heeft', () => {
    expect(localeFromEvent(event(''))).toBe('en');
    expect(localeFromEvent(event('de'))).toBe('en');
    expect(serverT('server.loginFailed')).toBe('The email address or password is incorrect.');
  });

  it('houdt gelijktijdige requestlocales van elkaar gescheiden', async () => {
    const [english, dutch] = await Promise.all([
      withRequestLocale(event('en'), async () => {
        await Promise.resolve();
        return serverT('server.loginFailed');
      }),
      withRequestLocale(event('nl'), async () => {
        await Promise.resolve();
        return serverT('server.loginFailed');
      })
    ]);

    expect(english).toBe('The email address or password is incorrect.');
    expect(dutch).toBe('E-mailadres of wachtwoord klopt niet.');
  });
});
