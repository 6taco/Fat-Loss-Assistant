import { NextRequest, NextResponse } from 'next/server';
import { dismissToolProposal } from '@/lib/mcp/executor';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

interface ProposalDecisionBody {
  userId?: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, body] = await Promise.all([params, request.json() as Promise<ProposalDecisionBody>]);
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;

  try {
    const proposal = await dismissToolProposal(id, auth.context.userId!);
    return NextResponse.json({ proposal, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Proposal dismiss failed') }, { status: 500 });
  }
}

