import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { requireBusinessUser } from '@/lib/auth-server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, body] = await Promise.all([params, request.json()]);
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const existing = await prisma.agentMemory.findFirst({ where: { id, userId } });
    if (!existing) return NextResponse.json({ error: 'Agent memory not found' }, { status: 404 });
    const memory = await prisma.agentMemory.update({
      where: { id: existing.id },
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireBusinessUser(request);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const deleted = await prisma.agentMemory.deleteMany({ where: { id, userId } });
    if (!deleted.count) return NextResponse.json({ error: 'Agent memory not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent memory delete failed' }, { status: 500 });
  }
}
