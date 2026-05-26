import { NextRequest, NextResponse } from 'next/server';
import { getCoachFeed } from '@/lib/coach';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const feed = await getCoachFeed(userId);
    return NextResponse.json({ feed, source: 'db' });
  } catch (error) {
    return NextResponse.json({ feed: { insights: [], proposals: [], notifications: [], memories: [] }, source: 'local', warning: getErrorMessage(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Coach feed request failed';
}
