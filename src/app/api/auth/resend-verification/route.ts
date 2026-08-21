import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth/errors';
import { enforceRateLimit } from '@/lib/auth/rate-limit';
import { resendVerification } from '@/lib/auth/service';
import { normalizeEmail } from '@/lib/auth/validation.js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email || '');
    await enforceRateLimit({ action: 'resend-verification', identifier: email, limit: 3, windowMs: 60 * 60 * 1_000 });
    await resendVerification(email);
    return NextResponse.json({ ok: true, message: '如果该邮箱需要验证，新的邮件将会发送。' });
  } catch (error) {
    return authErrorResponse(error);
  }
}
