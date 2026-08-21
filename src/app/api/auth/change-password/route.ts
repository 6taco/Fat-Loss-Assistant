import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { authErrorResponse } from '@/lib/auth/errors';
import { changePassword } from '@/lib/auth/service';
import { AUTH_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    await changePassword(auth.context.authUserId, body.currentPassword || '', body.newPassword || '');
    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, '', sessionCookieOptions());
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
