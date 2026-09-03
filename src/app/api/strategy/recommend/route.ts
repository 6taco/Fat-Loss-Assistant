import { NextRequest, NextResponse } from 'next/server';
import { recommendForUser } from '@/lib/strategy-engine/service';
import type { UserLifestyleProfile } from '@/lib/strategy-engine/types';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

export async function POST(request: NextRequest) {
  const body = await request.json() as { userId?: string; lifestyle?: Partial<UserLifestyleProfile> };
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;

  try {
    const recommendation = await recommendForUser(auth.context.userId!, body.lifestyle);
    return NextResponse.json({ recommendation, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Strategy recommendation failed'), source: 'local' }, { status: 503 });
  }
}

