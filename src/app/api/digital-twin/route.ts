import { NextRequest, NextResponse } from 'next/server';
import { getLatestDigitalTwin } from '@/lib/digital-twin/service';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const twin = await getLatestDigitalTwin(userId);
    return NextResponse.json({ twin });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Digital twin request failed' }, { status: 500 });
  }
}
