import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireCron } from '@/lib/auth-server';

// Rate-limit windows are minutes/hours; keep one day of rows for debugging.
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1_000;
// Keep expired/revoked auth records for a grace period so recent security
// events can still be inspected, then hard-delete.
const AUTH_RECORD_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const CONSUMED_RECORD_RETENTION_MS = 24 * 60 * 60 * 1_000;

export async function GET(request: Request) {
  const unauthorized = requireCron(request);
  if (unauthorized) return unauthorized;

  const prisma = getPrisma();
  const now = new Date();
  const staleRateLimitAt = new Date(now.getTime() - RATE_LIMIT_RETENTION_MS);
  const staleAuthRecordAt = new Date(now.getTime() - AUTH_RECORD_RETENTION_MS);
  const staleConsumedAt = new Date(now.getTime() - CONSUMED_RECORD_RETENTION_MS);

  const [rateLimits, sessions, authTokens, registrationChallenges] = await Promise.all([
    prisma.authRateLimit.deleteMany({ where: { updatedAt: { lt: staleRateLimitAt } } }),
    prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lt: staleAuthRecordAt } }, { revokedAt: { lt: staleAuthRecordAt } }] },
    }),
    prisma.authToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: staleConsumedAt } }] },
    }),
    prisma.registrationChallenge.deleteMany({
      where: { OR: [{ expiresAt: { lt: staleAuthRecordAt } }, { consumedAt: { lt: staleConsumedAt } }] },
    }),
  ]);

  return NextResponse.json({
    deleted: {
      rateLimits: rateLimits.count,
      sessions: sessions.count,
      authTokens: authTokens.count,
      registrationChallenges: registrationChallenges.count,
    },
  });
}
