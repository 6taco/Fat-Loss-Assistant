import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { dayPlanToResponse, toDate } from '@/lib/server-mappers';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage, getQueryLimit, parseJsonBody } from '@/lib/route-helpers';

const plansBodySchema = z.object({
  userId: z.string().optional(),
  plans: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    carbType: z.enum(['high', 'mid', 'low']),
    calories: z.number().int().min(0).max(20000),
    carb: z.number().min(0).max(2000),
    protein: z.number().min(0).max(2000),
    fat: z.number().min(0).max(2000),
    completed: z.boolean(),
    strategyId: z.string().optional(),
    strategyType: z.enum(['calorie_deficit', 'if_16_8', 'carb_cycling']).optional(),
    fastingWindow: z.unknown().optional(),
    dayGoal: z.unknown().optional(),
    muscleGroup: z.enum(['legs', 'back', 'chest', 'shoulders', 'arms', 'core', 'cardio', 'rest']).optional(),
    trainingLabel: z.string().max(100).optional(),
  })).min(1).max(400),
});

const patchBodySchema = z.object({
  userId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  completed: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const limit = getQueryLimit(request.nextUrl.searchParams, 400, 1000);
    // Newest-first take, then reversed back to chronological order.
    const plans = (await prisma.dayPlan.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    })).reverse();

    return NextResponse.json({ plans: plans.map(dayPlanToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed'), plans: [] }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, plansBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

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

    // Re-read only the affected date range instead of the user's whole table.
    const dates = body.plans.map(plan => plan.date).sort();
    const saved = await prisma.dayPlan.findMany({
      where: { userId, date: { gte: toDate(dates[0]), lte: toDate(dates[dates.length - 1]) } },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ plans: saved.map(dayPlanToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed') }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const parsed = await parseJsonBody(request, patchBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

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
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed') }, { status: 503 });
  }
}
