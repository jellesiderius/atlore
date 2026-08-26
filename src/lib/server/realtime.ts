import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$lib/server/config';

export interface RealtimeClaims {
  userId: string;
  userName: string;
  userColor: string;
  campaignId: string;
  canEdit: boolean;
  canWrite: boolean;
  expiresAt: number;
}

export function signRealtimeToken(claims: RealtimeClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', env.REALTIME_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyRealtimeToken(token: string): RealtimeClaims | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', env.REALTIME_SECRET).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as RealtimeClaims;
    if (
      !claims.userId ||
      !claims.userName ||
      !/^#[0-9a-f]{6}$/i.test(claims.userColor) ||
      !claims.campaignId ||
      typeof claims.canEdit !== 'boolean' ||
      typeof claims.canWrite !== 'boolean' ||
      claims.expiresAt < Date.now()
    )
      return null;
    return claims;
  } catch {
    return null;
  }
}
