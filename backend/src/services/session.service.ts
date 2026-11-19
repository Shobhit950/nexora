import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { refreshTokenLifetimeMs } from '../config/env';
import { sessions } from '../db/schema';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  return randomBytes(32).toString('base64url');
}

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + refreshTokenLifetimeMs);

  await db.insert(sessions).values({
    userId,
    expiresAt,
    refreshTokenHash: hashToken(token),
  });

  return { token, expiresAt };
}

function isRefreshToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function revokeSession(token: unknown) {
  if (!isRefreshToken(token)) {
    return;
  }

  await db.delete(sessions).where(eq(sessions.refreshTokenHash, hashToken(token)));
}

export async function rotateSession(token: unknown) {
  if (!isRefreshToken(token)) {
    return null;
  }

  const replacement = generateToken();
  // Matching and replacing the hash in one UPDATE makes the token single-use.
  const [session] = await db.update(sessions)
    .set({ refreshTokenHash: hashToken(replacement) })
    .where(and(
      eq(sessions.refreshTokenHash, hashToken(token)),
      gt(sessions.expiresAt, sql`clock_timestamp()`),
    ))
    .returning({ userId: sessions.userId, expiresAt: sessions.expiresAt });

  return session ? { ...session, token: replacement } : null;
}
