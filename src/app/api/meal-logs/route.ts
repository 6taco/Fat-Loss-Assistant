import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { mealLogToResponse, toDate } from '@/lib/server-mappers';
import { calculateMealCalories } from '@/lib/domain';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage, getQueryLimit, parseJsonBody } from '@/lib/route-helpers';

const isoDate = z.string().refine(value => !Number.isNaN(new Date(value).getTime()), 'invalid date');

const mealBodySchema = z.object({
  id: z.string().min(1).max(64).optional(),
  userId: z.string().optional(),
  date: isoDate,
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  description: z.string().min(1).max(2000),
  items: z.array(z.unknown()).max(50).optional(),
  carb: z.number().min(0).max(5000),
  protein: z.number().min(0).max(5000),
  fat: z.number().min(0).max(5000),
  calories: z.number().min(0).max(50000).optional(),
  source: z.enum(['ai', 'manual']).optional(),
  createdAt: isoDate.optional(),
});

const deleteBodySchema = z.object({
  id: z.string().min(1).max(64),
  userId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const limit = getQueryLimit(request.nextUrl.searchParams, 1000, 2000);
    // Newest-first take, then reversed back to chronological order.
    const meals = (await prisma.mealLog.findMany({
      where: { userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    })).reverse();

    return NextResponse.json({ meals: meals.map(mealLogToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed'), meals: [] }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, mealBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const mealData = {
      userId,
      date: toDate(body.date),
      mealType: body.mealType,
      description: body.description,
      items: (body.items || []) as unknown as Prisma.InputJsonValue,
      carb: body.carb,
      protein: body.protein,
      fat: body.fat,
      calories: body.calories ?? calculateMealCalories(body),
      source: body.source || 'manual',
    };
    if (body.id) {
      const existing = await prisma.mealLog.findFirst({ where: { id: body.id, userId } });
      if (existing) {
        const meal = await prisma.mealLog.update({ where: { id: existing.id }, data: mealData });
        return NextResponse.json({ meal: mealLogToResponse(meal), source: 'db' });
      }
    }
    const meal = await prisma.mealLog.create({
      data: {
        id: body.id,
        ...mealData,
        createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
      },
    });

    return NextResponse.json({ meal: mealLogToResponse(meal), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed') }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const parsed = await parseJsonBody(request, mealBodySchema.extend({ id: z.string().min(1).max(64) }));
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const existing = await prisma.mealLog.findFirst({ where: { id: body.id, userId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const meal = await prisma.mealLog.update({
      where: { id: existing.id },
      data: {
        date: toDate(body.date),
        mealType: body.mealType,
        description: body.description,
        items: (body.items || []) as unknown as Prisma.InputJsonValue,
        carb: body.carb,
        protein: body.protein,
        fat: body.fat,
        calories: body.calories ?? calculateMealCalories(body),
        source: body.source || 'manual',
      },
    });

    return NextResponse.json({ meal: mealLogToResponse(meal), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed') }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const parsed = await parseJsonBody(request, deleteBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const existing = await prisma.mealLog.findFirst({ where: { id: body.id, userId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.mealLog.delete({ where: { id: existing.id } });
    return NextResponse.json({ id: body.id, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed') }, { status: 503 });
  }
}
