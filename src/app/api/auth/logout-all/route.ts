import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { revokeAllSessions, AUTH_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  await revokeAllSessions(auth.context.authUserId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, '', sessionCookieOptions());
  return response;
}
