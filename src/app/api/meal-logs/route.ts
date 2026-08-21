import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { mealLogToResponse, toDate } from '@/lib/server-mappers';
import { calculateMealCalories, MealLog } from '@/lib/mock-data';
import { requireBusinessUser } from '@/lib/auth-server';

interface MealBody extends Partial<MealLog> {
  userId?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const meals = await prisma.mealLog.findMany({
      where: { userId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ meals: meals.map(mealLogToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), meals: [] }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as MealBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;
  const validation = validateMealBody(body);
  if (validation) return validation;

  try {
    const prisma = getPrisma();
    const mealData = {
      userId,
      date: toDate(body.date!),
      mealType: body.mealType!,
      description: body.description!,
      items: (body.items || []) as unknown as Prisma.InputJsonValue,
      carb: body.carb!,
      protein: body.protein!,
      fat: body.fat!,
      calories: body.calories ?? calculateMealCalories(body as MealLog),
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
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as MealBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;
  const validation = validateMealBody(body);
  if (validation) return validation;
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const existing = await prisma.mealLog.findFirst({ where: { id: body.id, userId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const meal = await prisma.mealLog.update({
      where: { id: existing.id },
      data: {
        date: toDate(body.date!),
        mealType: body.mealType!,
        description: body.description!,
        items: (body.items || []) as unknown as Prisma.InputJsonValue,
        carb: body.carb!,
        protein: body.protein!,
        fat: body.fat!,
        calories: body.calories ?? calculateMealCalories(body as MealLog),
        source: body.source || 'manual',
      },
    });

    return NextResponse.json({ meal: mealLogToResponse(meal), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json()) as { id?: string; userId?: string };
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const existing = await prisma.mealLog.findFirst({ where: { id: body.id, userId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.mealLog.delete({ where: { id: existing.id } });
    return NextResponse.json({ id: body.id, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 503 });
  }
}

function validateMealBody(body: MealBody) {
  if (!body.date || !body.mealType || !body.description) {
    return NextResponse.json({ error: 'date, mealType and description are required' }, { status: 400 });
  }
  if (body.carb === undefined || body.protein === undefined || body.fat === undefined) {
    return NextResponse.json({ error: 'carb, protein and fat are required' }, { status: 400 });
  }
  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
