import { getPrisma } from '@/lib/prisma';
import { AuthError } from '@/lib/auth/errors';

interface RateLimitInput {
  action: string;
  identifier: string;
  limit: number;
  windowMs: number;
}

export async function enforceRateLimit(input: RateLimitInput) {
  const prisma = getPrisma();
  const scopeKey = `${input.action}:${input.identifier}`.slice(0, 255);
  const now = new Date();
  const existing = await prisma.authRateLimit.findUnique({ where: { scopeKey } });

  if (!existing || now.getTime() - existing.windowStartedAt.getTime() >= input.windowMs) {
    await prisma.authRateLimit.upsert({
      where: { scopeKey },
      create: { scopeKey, action: input.action, windowStartedAt: now, attemptCount: 1 },
      update: { action: input.action, windowStartedAt: now, attemptCount: 1 },
    });
    return;
  }

  if (existing.attemptCount >= input.limit) throw new AuthError('AUTH_RATE_LIMITED', 429);
  await prisma.authRateLimit.update({ where: { scopeKey }, data: { attemptCount: { increment: 1 } } });
}
