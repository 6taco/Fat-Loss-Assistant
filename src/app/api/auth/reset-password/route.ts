import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth/errors';
import { resetPassword } from '@/lib/auth/service';
import { enforceRateLimit } from '@/lib/auth/rate-limit';
import { getRequestIp } from '@/lib/auth/request';

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit({ action: 'reset-password-ip', identifier: getRequestIp(request), limit: 20, windowMs: 60 * 60 * 1_000 });
    const body = await request.json();
    if (!body.token) return NextResponse.json({ error: 'INVALID_OR_EXPIRED_TOKEN' }, { status: 400 });
    await resetPassword(body.token, body.password || '');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
