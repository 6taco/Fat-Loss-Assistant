import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth/errors';
import { enforceRateLimit } from '@/lib/auth/rate-limit';
import { requestPasswordReset } from '@/lib/auth/service';
import { normalizeEmail } from '@/lib/auth/validation.js';
import { getRequestIp } from '@/lib/auth/request';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email || '');
    await Promise.all([
      enforceRateLimit({ action: 'forgot-password-email', identifier: email, limit: 3, windowMs: 60 * 60 * 1_000 }),
      enforceRateLimit({ action: 'forgot-password-ip', identifier: getRequestIp(request), limit: 10, windowMs: 60 * 60 * 1_000 }),
    ]);
    await requestPasswordReset(email);
    return NextResponse.json({ ok: true, message: '如果该邮箱已注册，重置邮件将会发送。' });
  } catch (error) {
    return authErrorResponse(error);
  }
}
