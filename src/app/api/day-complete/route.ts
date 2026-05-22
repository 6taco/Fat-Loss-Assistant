import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { dayPlanToResponse, toDate } from '@/lib/server-mappers';

interface DayCompleteBody {
  userId?: string;
  date?: string;
  completed?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as DayCompleteBody;

  if (!body.date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({
      date: body.date,
      completed: body.completed ?? true,
      updatedAt: new Date().toISOString(),
      source: 'local',
    });
  }

  try {
    const prisma = getPrisma();
    const plan = await prisma.dayPlan.update({
      where: {
        userId_date: {
          userId: body.userId,
          date: toDate(body.date),
        },
      },
      data: {
        completed: body.completed ?? true,
      },
    });

    return NextResponse.json({ plan: dayPlanToResponse(plan), source: 'db' });
  } catch (error) {
    return NextResponse.json({
      date: body.date,
      completed: body.completed ?? true,
      updatedAt: new Date().toISOString(),
      source: 'local',
      warning: getErrorMessage(error),
    });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
