import { NextRequest, NextResponse } from 'next/server';
import { revokeCurrentSession, AUTH_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  await revokeCurrentSession(request).catch(() => undefined);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, '', sessionCookieOptions());
  return response;
}
