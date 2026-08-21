import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStrategyResponse } from '@/lib/strategy-engine/service';
import { requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

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
