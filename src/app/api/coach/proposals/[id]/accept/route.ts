import { NextRequest, NextResponse } from 'next/server';
import { executeToolProposal } from '@/lib/mcp/executor';

interface ProposalDecisionBody {
  userId?: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, body] = await Promise.all([params, request.json() as Promise<ProposalDecisionBody>]);
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const proposal = await executeToolProposal(id, body.userId);
    return NextResponse.json({ proposal, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Proposal accept failed';
}
