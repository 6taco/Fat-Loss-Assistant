import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStrategyResponse } from '@/lib/strategy-engine/service';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const data = await getCurrentStrategyResponse(userId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'local' }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Strategy request failed';
}
