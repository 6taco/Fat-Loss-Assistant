import { NextRequest, NextResponse } from 'next/server';
import { activateStrategy } from '@/lib/strategy-engine/service';
import type { FatLossStrategyType, StrategyIntensity } from '@/lib/strategy-engine/types';
import { requireBusinessUser } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    userId?: string;
    strategyType?: FatLossStrategyType;
    intensity?: StrategyIntensity;
    startDate?: string;
  };
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;

  try {
    const data = await activateStrategy(auth.context.userId!, body);
    return NextResponse.json({ ...data, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'local' }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Strategy activation failed';
}
