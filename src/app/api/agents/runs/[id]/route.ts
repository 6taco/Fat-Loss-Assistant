import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const prisma = getPrisma();
    const [run, messages, findings] = await Promise.all([
      prisma.agentRun.findUnique({ where: { id } }),
      prisma.agentMessage.findMany({ where: { runId: id }, orderBy: { createdAt: 'asc' } }),
      prisma.agentFinding.findMany({ where: { runId: id }, orderBy: { createdAt: 'asc' } }),
    ]);

    if (!run) return NextResponse.json({ error: 'Agent run not found' }, { status: 404 });
    return NextResponse.json({ run, messages, findings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent run request failed' }, { status: 500 });
  }
}
