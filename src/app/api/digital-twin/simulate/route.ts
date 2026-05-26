import { NextRequest, NextResponse } from 'next/server';
import { simulateDigitalTwinScenario } from '@/lib/digital-twin/service';
import type { ScenarioInput } from '@/lib/digital-twin/types';

interface SimulateBody {
  userId?: string;
  scenario?: ScenarioInput;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SimulateBody;
  if (!body.userId || !body.scenario?.type) {
    return NextResponse.json({ error: 'userId and scenario.type are required' }, { status: 400 });
  }

  try {
    const result = await simulateDigitalTwinScenario(body.userId, body.scenario);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Digital twin simulate failed' }, { status: 500 });
  }
}
