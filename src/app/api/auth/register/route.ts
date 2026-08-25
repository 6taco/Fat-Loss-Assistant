import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth/errors';
import { withAuthDatabaseRetry } from '@/lib/auth/database-retry.js';
import { enforceRateLimit } from '@/lib/auth/rate-limit';
import { getRequestIp } from '@/lib/auth/request';
import { verifyRegistrationCode } from '@/lib/auth/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await withAuthDatabaseRetry(() => enforceRateLimit({
      action: 'register',
      identifier: getRequestIp(request),
      limit: 10,
      windowMs: 60 * 60 * 1_000,
    }));
    await withAuthDatabaseRetry(() => verifyRegistrationCode(body.email || '', body.code || ''));
    return NextResponse.json({ ok: true, status: 'registered' });
  } catch (error) {
    return authErrorResponse(error);
  }
}
