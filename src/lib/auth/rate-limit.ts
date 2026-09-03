import { getPrisma } from '@/lib/prisma';
import { AuthError } from '@/lib/auth/errors';

interface RateLimitInput {
  action: string;
  identifier: string;
  limit: number;
  windowMs: number;
}

type PrismaClient = ReturnType<typeof getPrisma>;

export async function enforceRateLimit(input: RateLimitInput) {
  const prisma = getPrisma();
  const scopeKey = `${input.action}:${input.identifier}`.slice(0, 255);
  const now = new Date();
  const activeWindowStart = new Date(now.getTime() - input.windowMs);

  // Every write below is a single conditional statement, so row locks keep the
  // counter accurate under concurrent requests: a slot is only claimed while
  // the window is active and the count is below the limit.
  if (await claimRateLimitSlot(prisma, scopeKey, activeWindowStart, input.limit)) return;

  const reset = await prisma.authRateLimit.updateMany({
    where: { scopeKey, windowStartedAt: { lte: activeWindowStart } },
    data: { action: input.action, windowStartedAt: now, attemptCount: 1 },
  });
  if (reset.count > 0) return;

  const existing = await prisma.authRateLimit.findUnique({ where: { scopeKey } });
  if (existing) {
    // The row exists with a full active window — unless a concurrent request
    // just refreshed it between our attempts, so claim once more before
    // rejecting to avoid false negatives at the window boundary.
    if (await claimRateLimitSlot(prisma, scopeKey, activeWindowStart, input.limit)) return;
    throw new AuthError('AUTH_RATE_LIMITED', 429);
  }

  try {
    await prisma.authRateLimit.create({
      data: { scopeKey, action: input.action, windowStartedAt: now, attemptCount: 1 },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    // Lost a creation race with another first-time request: claim a slot in
    // the window the winner just opened.
    if (!await claimRateLimitSlot(prisma, scopeKey, activeWindowStart, input.limit)) {
      throw new AuthError('AUTH_RATE_LIMITED', 429);
    }
  }
}

async function claimRateLimitSlot(
  prisma: PrismaClient,
  scopeKey: string,
  activeWindowStart: Date,
  limit: number,
) {
  const claimed = await prisma.authRateLimit.updateMany({
    where: { scopeKey, windowStartedAt: { gt: activeWindowStart }, attemptCount: { lt: limit } },
    data: { attemptCount: { increment: 1 } },
  });
  return claimed.count > 0;
}

function isUniqueConstraintError(error: unknown) {
  return (error as { code?: unknown })?.code === 'P2002';
}
