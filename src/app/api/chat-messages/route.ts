import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { chatToResponse } from '@/lib/server-mappers';
import { ChatMessage, mockChatMessages } from '@/lib/mock-data';

interface ChatMessageBody extends ChatMessage {
  userId?: string;
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ messages: messages.map(chatToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ messages: [], source: 'local', warning: getErrorMessage(error) });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ChatMessageBody;
  if (!body.role || !body.content) {
    return NextResponse.json({ error: 'role and content are required' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();

    const message = await prisma.chatMessage.create({
      data: {
        id: body.id,
        userId: body.userId || null,
        role: body.role,
        content: body.content,
        cards: body.cards ? (body.cards as unknown as Prisma.InputJsonValue) : undefined,
        createdAt: body.timestamp ? new Date(body.timestamp) : undefined,
      },
    });

    return NextResponse.json({ message: chatToResponse(message), source: 'db' });
  } catch (error) {
    return NextResponse.json({
      message: mockChatMessages.find(message => message.id === body.id) || body,
      source: 'local',
      warning: getErrorMessage(error),
    });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
