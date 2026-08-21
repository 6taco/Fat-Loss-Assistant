import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth/errors';
import { enforceRateLimit } from '@/lib/auth/rate-limit';
import { getRequestIp } from '@/lib/auth/request';
import { registerAccount } from '@/lib/auth/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await enforceRateLimit({ action: 'register', identifier: getRequestIp(request), limit: 10, windowMs: 60 * 60 * 1_000 });
    await registerAccount(body);
    return NextResponse.json({ ok: true, status: 'registered' });
  } catch (error) {
    return authErrorResponse(error);
  }
}
