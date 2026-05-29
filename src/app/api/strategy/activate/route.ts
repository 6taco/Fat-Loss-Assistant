import { NextRequest, NextResponse } from 'next/server';
import { activateStrategy } from '@/lib/strategy-engine/service';
import type { FatLossStrategyType, StrategyIntensity } from '@/lib/strategy-engine/types';

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    userId?: string;
    strategyType?: FatLossStrategyType;
    intensity?: StrategyIntensity;
    startDate?: string;
  };
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const data = await activateStrategy(body.userId, body);
    return NextResponse.json({ ...data, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'local' }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Strategy activation failed';
}
