import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth/errors';
import { enforceRateLimit } from '@/lib/auth/rate-limit';
import { loginAccount } from '@/lib/auth/service';
import { AUTH_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session';
import { normalizeEmail } from '@/lib/auth/validation';
import { getRequestIp } from '@/lib/auth/request';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email || '');
    await Promise.all([
      enforceRateLimit({ action: 'login-email', identifier: email, limit: 10, windowMs: 15 * 60 * 1_000 }),
      enforceRateLimit({ action: 'login-ip', identifier: getRequestIp(request), limit: 30, windowMs: 15 * 60 * 1_000 }),
    ]);
    const result = await loginAccount(body, request);
    const response = NextResponse.json({ ok: true, user: result.user });
    response.cookies.set(AUTH_COOKIE_NAME, result.session.rawToken, sessionCookieOptions(result.session.expiresAt));
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
