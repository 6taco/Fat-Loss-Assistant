import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

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
