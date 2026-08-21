import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { chatToResponse } from '@/lib/server-mappers';
import { ChatMessage } from '@/lib/mock-data';
import { requireBusinessUser } from '@/lib/auth-server';

interface ChatMessageBody extends ChatMessage {
  userId?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ messages: messages.map(chatToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), messages: [] }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ChatMessageBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;
  if (!body.role || !body.content) {
    return NextResponse.json({ error: 'role and content are required' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();

    const message = await prisma.chatMessage.create({
      data: {
        id: body.id,
        userId,
        role: body.role,
        content: body.content,
        cards: body.cards ? (body.cards as unknown as Prisma.InputJsonValue) : undefined,
        createdAt: body.timestamp ? new Date(body.timestamp) : undefined,
      },
    });

    return NextResponse.json({ message: chatToResponse(message), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
