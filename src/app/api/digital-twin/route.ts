import { NextRequest, NextResponse } from 'next/server';
import { getLatestDigitalTwin } from '@/lib/digital-twin/service';
import { requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const twin = await getLatestDigitalTwin(userId);
    return NextResponse.json({ twin });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Digital twin request failed' }, { status: 500 });
  }
}
