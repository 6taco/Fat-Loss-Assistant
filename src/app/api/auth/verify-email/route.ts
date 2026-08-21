import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/auth/service';

export async function GET(request: NextRequest) {
  const appUrl = process.env.APP_URL || request.nextUrl.origin;
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(`${appUrl}/accounts?verified=0&reason=invalid_token`);
  try {
    await verifyEmailToken(token);
    return NextResponse.redirect(`${appUrl}/accounts?verified=1`);
  } catch {
    return NextResponse.redirect(`${appUrl}/accounts?verified=0&reason=invalid_token`);
  }
}
