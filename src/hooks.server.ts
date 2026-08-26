import type { Handle, HandleServerError } from '@sveltejs/kit';
import { env, trustedOrigins } from '$lib/server/config';
import { clearSessionCookie, validateSession } from '$lib/server/auth';
import { isRequestOriginAllowed } from '$lib/server/security';

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(env.SESSION_COOKIE_NAME);
  try {
    const session = await validateSession(token);
    event.locals.user = session?.user ?? null;
    event.locals.sessionId = session?.sessionId ?? null;
    if (token && !session) clearSessionCookie(event.cookies);
  } catch (cause) {
    console.error('Session validation failed', cause);
    event.locals.user = null;
    event.locals.sessionId = null;
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
    const origin = event.request.headers.get('origin');
    if (
      !isRequestOriginAllowed({
        origin,
        requestUrl: event.url,
        host: event.request.headers.get('host'),
        configuredOrigins: [env.ORIGIN, ...trustedOrigins]
      })
    ) {
      return new Response('Ongeldige request origin.', { status: 403 });
    }
  }

  const response = await resolve(event, {
    filterSerializedResponseHeaders: (name) => name === 'content-type' || name === 'content-length'
  });
  response.headers.set('cross-origin-opener-policy', 'same-origin');
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('x-frame-options', 'DENY');
  return response;
};

export const handleError: HandleServerError = ({ error, status, message }) => {
  if (status >= 500) console.error(error);
  return { message: status >= 500 ? 'Er ging iets mis. Probeer het opnieuw.' : message };
};
