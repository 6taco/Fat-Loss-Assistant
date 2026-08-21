import { NextRequest, NextResponse } from 'next/server';
import { recheckStrategy } from '@/lib/strategy-engine/service';
import { requireBusinessUser } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  const body = await request.json() as { userId?: string };
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;

  try {
    const data = await recheckStrategy(auth.context.userId!);
    return NextResponse.json({ ...data, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'local' }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Strategy recheck failed';
}
