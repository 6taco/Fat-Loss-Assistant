import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

interface ReadBody {
  userId?: string;
  type?: 'daily' | 'weekly';
  id?: string;
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as ReadBody;
  if (!body.userId || !body.type || !body.id) {
    return NextResponse.json({ error: 'userId, type and id are required' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const readAt = new Date();

    if (body.type === 'daily') {
      await prisma.dailyReport.update({
        where: { id: body.id, userId: body.userId },
        data: { readAt },
      });
    } else {
      await prisma.weeklyReport.update({
        where: { id: body.id, userId: body.userId },
        data: { readAt },
      });
    }

    return NextResponse.json({ id: body.id, type: body.type, readAt: readAt.toISOString(), source: 'db' });
  } catch (error) {
    return NextResponse.json({ id: body.id, type: body.type, readAt: new Date().toISOString(), source: 'local', warning: getErrorMessage(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Report read update failed';
}
