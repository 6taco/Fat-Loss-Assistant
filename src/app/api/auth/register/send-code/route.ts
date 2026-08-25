import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth/errors';
import { withAuthDatabaseRetry } from '@/lib/auth/database-retry.js';
import { enforceRateLimit } from '@/lib/auth/rate-limit';
import { getRequestIp } from '@/lib/auth/request';
import { requestRegistrationCode } from '@/lib/auth/service';
import { normalizeEmail } from '@/lib/auth/validation.js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email || '');
    await Promise.all([
      withAuthDatabaseRetry(() => enforceRateLimit({ action: 'register-code-email-minute', identifier: email, limit: 1, windowMs: 60 * 1_000 })),
      withAuthDatabaseRetry(() => enforceRateLimit({ action: 'register-code-email-hour', identifier: email, limit: 5, windowMs: 60 * 60 * 1_000 })),
      withAuthDatabaseRetry(() => enforceRateLimit({ action: 'register-code-ip-hour', identifier: getRequestIp(request), limit: 20, windowMs: 60 * 60 * 1_000 })),
    ]);
    await withAuthDatabaseRetry(() => requestRegistrationCode(body));
    return NextResponse.json({ ok: true, message: '如果邮箱可以注册，验证码将发送到你的邮箱。' });
  } catch (error) {
    return authErrorResponse(error);
  }
}
