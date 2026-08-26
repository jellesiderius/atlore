import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { and, eq, gt } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { authSessions, users } from '$lib/server/db/schema';
import { env, useSecureCookies } from '$lib/server/config';
import type { SessionUser } from '$lib/types';

const DAY = 86_400_000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32
  });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date): void {
  cookies.set(env.SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    expires: expiresAt
  });
}

export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(env.SESSION_COOKIE_NAME, { path: '/' });
}

export async function createSession(
  userId: string,
  cookies: Cookies,
  context: { userAgent?: string | null; ipAddress?: string | null } = {}
): Promise<void> {
  const token = createToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * DAY);
  await db.insert(authSessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: context.userAgent?.slice(0, 500),
    ipAddress: context.ipAddress?.slice(0, 80),
    expiresAt
  });
  setSessionCookie(cookies, token, expiresAt);
}

export async function validateSession(
  token: string | undefined
): Promise<{ user: SessionUser; sessionId: string } | null> {
  if (!token) return null;
  const [row] = await db
    .select({
      sessionId: authSessions.id,
      lastSeenAt: authSessions.lastSeenAt,
      userId: users.id,
      name: users.name,
      email: users.email,
      color: users.color
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(
      and(eq(authSessions.tokenHash, hashToken(token)), gt(authSessions.expiresAt, new Date()))
    )
    .limit(1);
  if (!row) return null;
  if (Date.now() - row.lastSeenAt.getTime() > 15 * 60_000) {
    void db
      .update(authSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(authSessions.id, row.sessionId));
  }
  return {
    sessionId: row.sessionId,
    user: { id: row.userId, name: row.name, email: row.email, color: row.color }
  };
}

export async function deleteSession(sessionId: string | null): Promise<void> {
  if (sessionId) await db.delete(authSessions).where(eq(authSessions.id, sessionId));
}
