import { NextRequest, NextResponse } from 'next/server';
import { recheckStrategy } from '@/lib/strategy-engine/service';

export async function POST(request: NextRequest) {
  const body = await request.json() as { userId?: string };
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const data = await recheckStrategy(body.userId);
    return NextResponse.json({ ...data, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'local' }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Strategy recheck failed';
}
