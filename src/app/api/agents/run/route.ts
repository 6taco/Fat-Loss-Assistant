import { NextRequest, NextResponse } from 'next/server';
import { runAgentWorkflow } from '@/lib/agents/orchestrator';
import type { AgentIntent, AgentRunType } from '@/lib/agents/types';

interface AgentRunBody {
  userId?: string;
  runType?: AgentRunType;
  date?: string;
  intent?: AgentIntent;
  message?: string;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AgentRunBody;
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const result = await runAgentWorkflow({
      userId: body.userId,
      runType: body.runType || 'manual',
      date: body.date,
      intent: body.intent,
      message: body.message,
      force: body.force,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent workflow failed' }, { status: 500 });
  }
}
