import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const findings = await prisma.agentFinding.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ findings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent findings request failed' }, { status: 500 });
  }
}
