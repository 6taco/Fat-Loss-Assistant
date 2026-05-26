import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

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
