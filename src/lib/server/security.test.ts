import { describe, expect, it } from 'vitest';
import { isRequestOriginAllowed } from './security';

const check = (origin: string | null, host = 'localhost:3000', configuredOrigins: string[] = []) =>
  isRequestOriginAllowed({
    origin,
    host,
    requestUrl: new URL('http://localhost:3000/auth/login'),
    configuredOrigins
  });

describe('request origin validation', () => {
  it('accepteert de geconfigureerde origin', () => {
    expect(check('http://localhost:3000')).toBe(true);
  });

  it('accepteert de origin die via de werkelijke Host-header is geopend', () => {
    expect(check('http://127.0.0.1:3000', '127.0.0.1:3000')).toBe(true);
  });

  it('accepteert expliciet vertrouwde proxy-origins', () => {
    expect(check('https://atlore.example', 'app:3000', ['https://atlore.example'])).toBe(true);
  });

  it('weigert een cross-site en een ongeldige origin', () => {
    expect(check('https://evil.example')).toBe(false);
    expect(check('geen-url')).toBe(false);
  });

  it('staat niet-browserclients zonder Origin-header toe', () => {
    expect(check(null)).toBe(true);
  });
});
