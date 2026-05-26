import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { mealLogToResponse, toDate } from '@/lib/server-mappers';
import { calculateMealCalories, MealLog } from '@/lib/mock-data';

interface MealBody extends Partial<MealLog> {
  userId?: string;
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const meals = await prisma.mealLog.findMany({
      where: { userId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ meals: meals.map(mealLogToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ meals: [], source: 'local', warning: getErrorMessage(error) });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as MealBody;
  const validation = validateMealBody(body);
  if (validation) return validation;

  try {
    const prisma = getPrisma();
    const mealData = {
      userId: body.userId!,
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
    const meal = body.id ? await prisma.mealLog.upsert({
      where: { id: body.id },
      create: {
        id: body.id,
        ...mealData,
        createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
      },
      update: mealData,
    }) : await prisma.mealLog.create({
      data: {
        ...mealData,
        createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
      },
    });

    return NextResponse.json({ meal: mealLogToResponse(meal), source: 'db' });
  } catch (error) {
    return NextResponse.json({ meal: body, source: 'local', warning: getErrorMessage(error) });
  }
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as MealBody;
  const validation = validateMealBody(body);
  if (validation) return validation;
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const meal = await prisma.mealLog.update({
      where: { id: body.id },
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
    return NextResponse.json({ meal: body, source: 'local', warning: getErrorMessage(error) });
  }
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json()) as { id?: string; userId?: string };
  if (!body.id || !body.userId) {
    return NextResponse.json({ error: 'id and userId are required' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    await prisma.mealLog.delete({ where: { id: body.id } });
    return NextResponse.json({ id: body.id, source: 'db' });
  } catch (error) {
    return NextResponse.json({ id: body.id, source: 'local', warning: getErrorMessage(error) });
  }
}

function validateMealBody(body: MealBody) {
  if (!body.userId || !body.date || !body.mealType || !body.description) {
    return NextResponse.json({ error: 'userId, date, mealType and description are required' }, { status: 400 });
  }
  if (body.carb === undefined || body.protein === undefined || body.fat === undefined) {
    return NextResponse.json({ error: 'carb, protein and fat are required' }, { status: 400 });
  }
  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
