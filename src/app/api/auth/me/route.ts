import { NextRequest, NextResponse } from 'next/server';
import { optionalAuth } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const context = await optionalAuth(request);
    if (!context) return NextResponse.json({ authenticated: false });
    return NextResponse.json({
      authenticated: true,
      user: {
        id: context.authUserId,
        email: context.email,
        hasProfile: Boolean(context.userId),
        profileUserId: context.userId,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
