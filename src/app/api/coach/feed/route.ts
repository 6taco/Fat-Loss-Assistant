import { NextRequest, NextResponse } from 'next/server';
import { getCoachFeed } from '@/lib/coach';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const feed = await getCoachFeed(userId);
    return NextResponse.json({ feed, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Coach feed request failed') }, { status: 503 });
  }
}

