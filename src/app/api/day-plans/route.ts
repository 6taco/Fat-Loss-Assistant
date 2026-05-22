import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { dayPlanToResponse, toDate } from '@/lib/server-mappers';
import { DayPlan, mockPlan } from '@/lib/mock-data';

interface PlansBody {
  userId?: string;
  plans?: DayPlan[];
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const plans = await prisma.dayPlan.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ plans: plans.map(dayPlanToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ plans: [], source: 'local', warning: getErrorMessage(error) });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as PlansBody;
  if (!body.userId || !Array.isArray(body.plans)) {
    return NextResponse.json({ error: 'userId and plans are required' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();

    await prisma.$transaction(
      body.plans.map(plan => prisma.dayPlan.upsert({
        where: {
          userId_date: {
            userId: body.userId!,
            date: toDate(plan.date),
          },
        },
        create: {
          userId: body.userId!,
          date: toDate(plan.date),
          carbType: plan.carbType,
          calories: plan.calories,
          carb: plan.carb,
          protein: plan.protein,
          fat: plan.fat,
          completed: plan.completed,
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
          muscleGroup: plan.muscleGroup,
          trainingLabel: plan.trainingLabel,
        },
      })),
    );

    const saved = await prisma.dayPlan.findMany({
      where: { userId: body.userId },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ plans: saved.map(dayPlanToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ plans: body.plans, source: 'local', warning: getErrorMessage(error) });
  }
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { userId?: string; date?: string; completed?: boolean };
  if (!body.userId || !body.date) {
    return NextResponse.json({ error: 'userId and date are required' }, { status: 400 });
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
    const fallback = mockPlan.find(plan => plan.date === body.date);
    return NextResponse.json({
      plan: fallback ? { ...fallback, completed: body.completed ?? true } : { date: body.date, completed: body.completed ?? true },
      source: 'local',
      warning: getErrorMessage(error),
    });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
