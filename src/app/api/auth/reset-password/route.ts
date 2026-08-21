import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse } from '@/lib/auth/errors';
import { resetPassword } from '@/lib/auth/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.token) return NextResponse.json({ error: 'INVALID_OR_EXPIRED_TOKEN' }, { status: 400 });
    await resetPassword(body.token, body.password || '');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
