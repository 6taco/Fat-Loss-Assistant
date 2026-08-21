import { NextRequest, NextResponse } from 'next/server';
import { simulateDigitalTwinScenario } from '@/lib/digital-twin/service';
import type { ScenarioInput } from '@/lib/digital-twin/types';
import { requireBusinessUser } from '@/lib/auth-server';

interface SimulateBody {
  userId?: string;
  scenario?: ScenarioInput;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SimulateBody;
  if (!body.scenario?.type) {
    return NextResponse.json({ error: 'scenario.type is required' }, { status: 400 });
  }
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const result = await simulateDigitalTwinScenario(userId, body.scenario);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Digital twin simulate failed' }, { status: 500 });
  }
}
