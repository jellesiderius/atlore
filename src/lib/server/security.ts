function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

type OriginCheck = {
  origin: string | null;
  requestUrl: URL;
  host: string | null;
  configuredOrigins: string[];
};

/**
 * Accept the configured public origins and the origin the browser actually used.
 * The latter is derived from the Host header, which makes direct Docker access via
 * localhost, 127.0.0.1, a LAN hostname or a non-default APP_PORT work correctly.
 */
export function isRequestOriginAllowed({
  origin,
  requestUrl,
  host,
  configuredOrigins
}: OriginCheck): boolean {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  const allowed = new Set(
    configuredOrigins.map(normalizeOrigin).filter((value): value is string => value !== null)
  );
  allowed.add(requestUrl.origin);

  if (host) {
    const directRequestOrigin = normalizeOrigin(`${requestUrl.protocol}//${host}`);
    if (directRequestOrigin) allowed.add(directRequestOrigin);
  }

  return allowed.has(normalizedOrigin);
}
