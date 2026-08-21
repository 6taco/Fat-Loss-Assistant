import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessUser(request);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const [run, messages, findings] = await Promise.all([
      prisma.agentRun.findFirst({ where: { id, userId } }),
      prisma.agentMessage.findMany({ where: { runId: id }, orderBy: { createdAt: 'asc' } }),
      prisma.agentFinding.findMany({ where: { runId: id }, orderBy: { createdAt: 'asc' } }),
    ]);

    if (!run) return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
    return NextResponse.json({ run, messages, findings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent run request failed' }, { status: 500 });
  }
}
