import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, body] = await Promise.all([params, request.json()]);

  try {
    const prisma = getPrisma();
    const memory = await prisma.agentMemory.update({
      where: { id },
      data: {
        ...(typeof body.title === 'string' ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content as Prisma.InputJsonValue } : {}),
        ...(typeof body.confidence === 'number' ? { confidence: body.confidence } : {}),
      },
    });
    return NextResponse.json({ memory });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent memory update failed' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const prisma = getPrisma();
    await prisma.agentMemory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent memory delete failed' }, { status: 500 });
  }
}
