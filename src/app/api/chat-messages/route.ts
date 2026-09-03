import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { chatToResponse } from '@/lib/server-mappers';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage, getQueryLimit, parseJsonBody } from '@/lib/route-helpers';

const isoDate = z.string().refine(value => !Number.isNaN(new Date(value).getTime()), 'invalid date');

const chatMessageBodySchema = z.object({
  // Client-supplied for idempotent local-data import; validated to sane bounds.
  id: z.string().min(1).max(64).optional(),
  userId: z.string().optional(),
  role: z.enum(['user', 'ai']),
  content: z.string().min(1).max(8000),
  timestamp: isoDate.optional(),
  cards: z.unknown().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const limit = getQueryLimit(request.nextUrl.searchParams, 500, 1000);
    // Newest-first take, then reversed back to chronological order.
    const messages = (await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })).reverse();

    return NextResponse.json({ messages: messages.map(chatToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed'), messages: [] }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, chatMessageBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();

    const message = await prisma.chatMessage.create({
      data: {
        id: body.id,
        userId,
        role: body.role,
        content: body.content,
        cards: body.cards !== undefined ? (body.cards as Prisma.InputJsonValue) : undefined,
        createdAt: body.timestamp ? new Date(body.timestamp) : undefined,
      },
    });

    return NextResponse.json({ message: chatToResponse(message), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed') }, { status: 503 });
  }
}
