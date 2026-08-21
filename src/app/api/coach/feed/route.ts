import { NextRequest, NextResponse } from 'next/server';
import { getCoachFeed } from '@/lib/coach';
import { requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const feed = await getCoachFeed(userId);
    return NextResponse.json({ feed, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Coach feed request failed';
}
