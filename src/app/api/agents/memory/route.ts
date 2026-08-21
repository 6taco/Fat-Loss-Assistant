import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

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
  if (!body.agent || !body.type || !body.title) {
    return NextResponse.json({ error: 'agent, type and title are required' }, { status: 400 });
  }
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const memory = await prisma.agentMemory.create({
      data: {
        userId,
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
