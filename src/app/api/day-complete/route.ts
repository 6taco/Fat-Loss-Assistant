import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { dayPlanToResponse, toDate } from '@/lib/server-mappers';
import { requireBusinessUser } from '@/lib/auth-server';

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

  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;

  try {
    const prisma = getPrisma();
    const plan = await prisma.dayPlan.update({
      where: {
        userId_date: {
          userId: auth.context.userId!,
          date: toDate(body.date),
        },
      },
      data: {
        completed: body.completed ?? true,
      },
    });

    return NextResponse.json({ plan: dayPlanToResponse(plan), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
