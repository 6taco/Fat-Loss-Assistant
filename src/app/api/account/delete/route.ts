import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-server';
import { authErrorResponse } from '@/lib/auth/errors';
import { AuthError } from '@/lib/auth/errors';
import { verifyPassword } from '@/lib/auth/password';
import { enforceRateLimit } from '@/lib/auth/rate-limit';
import { getRequestIp } from '@/lib/auth/request';
import { AUTH_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session';

const bodySchema = z.object({ password: z.string().min(1, 'password is required') });

// Right-to-erasure endpoint: removes the account and every stored trace of
// the user. Business data cascades from User; the agent/digital-twin/tool/
// analytics tables carry plain userId columns and are cleared explicitly.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  try {
    await enforceRateLimit({ action: 'account-delete-ip', identifier: getRequestIp(request), limit: 10, windowMs: 60 * 60 * 1_000 });
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError('INVALID_INPUT', 400);
    }

    const prisma = getPrisma();
    const authUser = await prisma.authUser.findUnique({ where: { id: auth.context.authUserId } });
    if (!authUser || !await verifyPassword(parsed.data.password, authUser.passwordHash)) {
      throw new AuthError('INVALID_CREDENTIALS', 401);
    }

    await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({
        where: { authUserId: auth.context.authUserId },
        select: { id: true },
      });
      const userId = user?.id;

      if (userId) {
        await Promise.all([
          tx.digitalTwinProfile.deleteMany({ where: { userId } }),
          tx.digitalTwinFeatureSnapshot.deleteMany({ where: { userId } }),
          tx.digitalTwinPrediction.deleteMany({ where: { userId } }),
          tx.digitalTwinScenario.deleteMany({ where: { userId } }),
          tx.agentRun.deleteMany({ where: { userId } }),
          tx.agentMessage.deleteMany({ where: { userId } }),
          tx.agentFinding.deleteMany({ where: { userId } }),
          tx.agentMemory.deleteMany({ where: { userId } }),
          tx.toolInvocationLog.deleteMany({ where: { userId } }),
          tx.toolExecutionLog.deleteMany({ where: { userId } }),
          tx.toolExecutionSnapshot.deleteMany({ where: { userId } }),
          tx.ragQueryLog.deleteMany({ where: { userId } }),
          tx.analyticsEvent.deleteMany({ where: { userId } }),
          tx.analyticsSession.deleteMany({ where: { userId } }),
          tx.analyticsIdentity.deleteMany({ where: { userId } }),
          tx.analyticsUserLifecycle.deleteMany({ where: { userId } }),
        ]);
        // Cascades plans, meals, weights, reports, strategies, insights,
        // proposals, memories, notifications, body metrics, chat, etc.
        await tx.user.delete({ where: { id: userId } });
      }

      // Cascades sessions, auth tokens and import batches; the current
      // session cookie dies with it.
      await tx.authUser.delete({ where: { id: auth.context.authUserId } });
    }, { timeout: 30_000, maxWait: 5_000 });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, '', sessionCookieOptions());
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
