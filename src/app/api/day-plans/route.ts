import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { dayPlanToResponse, toDate } from '@/lib/server-mappers';
import { DayPlan } from '@/lib/mock-data';
import { requireBusinessUser } from '@/lib/auth-server';

interface PlansBody {
  userId?: string;
  plans?: DayPlan[];
}

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const plans = await prisma.dayPlan.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ plans: plans.map(dayPlanToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), plans: [] }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as PlansBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;
  if (!Array.isArray(body.plans)) {
    return NextResponse.json({ error: 'plans are required' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();

    await prisma.$transaction(
      body.plans.map(plan => prisma.dayPlan.upsert({
        where: {
          userId_date: {
            userId,
            date: toDate(plan.date),
          },
        },
        create: {
          userId,
          date: toDate(plan.date),
          carbType: plan.carbType,
          calories: plan.calories,
          carb: plan.carb,
          protein: plan.protein,
          fat: plan.fat,
          completed: plan.completed,
          strategyId: plan.strategyId,
          strategyType: plan.strategyType || 'carb_cycling',
          fastingWindow: plan.fastingWindow as Prisma.InputJsonValue | undefined,
          dayGoal: plan.dayGoal as Prisma.InputJsonValue | undefined,
          muscleGroup: plan.muscleGroup,
          trainingLabel: plan.trainingLabel,
        },
        update: {
          carbType: plan.carbType,
          calories: plan.calories,
          carb: plan.carb,
          protein: plan.protein,
          fat: plan.fat,
          completed: plan.completed,
          strategyId: plan.strategyId,
          strategyType: plan.strategyType || 'carb_cycling',
          fastingWindow: plan.fastingWindow as Prisma.InputJsonValue | undefined,
          dayGoal: plan.dayGoal as Prisma.InputJsonValue | undefined,
          muscleGroup: plan.muscleGroup,
          trainingLabel: plan.trainingLabel,
        },
      })),
    );

    const saved = await prisma.dayPlan.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ plans: saved.map(dayPlanToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { userId?: string; date?: string; completed?: boolean };
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;
  if (!body.date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();

    const plan = await prisma.dayPlan.update({
      where: {
        userId_date: {
          userId,
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
