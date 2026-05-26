import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const runs = await prisma.agentRun.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });
    return NextResponse.json({ runs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent runs request failed' }, { status: 500 });
  }
}
