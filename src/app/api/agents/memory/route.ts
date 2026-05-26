import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const memories = await prisma.agentMemory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ memories });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent memory request failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.userId || !body.agent || !body.type || !body.title) {
    return NextResponse.json({ error: 'userId, agent, type and title are required' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const memory = await prisma.agentMemory.create({
      data: {
        userId: body.userId,
        agent: body.agent,
        type: body.type,
        title: body.title,
        content: (body.content ?? {}) as Prisma.InputJsonValue,
        confidence: typeof body.confidence === 'number' ? body.confidence : 0.6,
        source: body.source || 'manual',
      },
    });
    return NextResponse.json({ memory });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent memory create failed' }, { status: 500 });
  }
}
