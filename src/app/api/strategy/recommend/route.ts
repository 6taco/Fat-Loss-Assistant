import { NextRequest, NextResponse } from 'next/server';
import { recommendForUser } from '@/lib/strategy-engine/service';
import type { UserLifestyleProfile } from '@/lib/strategy-engine/types';

export async function POST(request: NextRequest) {
  const body = await request.json() as { userId?: string; lifestyle?: Partial<UserLifestyleProfile> };
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const recommendation = await recommendForUser(body.userId, body.lifestyle);
    return NextResponse.json({ recommendation, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'local' }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Strategy recommendation failed';
}
