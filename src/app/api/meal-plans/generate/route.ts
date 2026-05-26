import { NextRequest, NextResponse } from 'next/server';
import { generateMealPlans } from '@/lib/coach';
import { dateToISODate } from '@/lib/server-mappers';

interface GenerateMealPlansBody {
  userId?: string;
  startDate?: string;
  days?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateMealPlansBody;
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const mealPlans = await generateMealPlans(body.userId, body.startDate || dateToISODate(new Date()), body.days || 3);
    return NextResponse.json({
      mealPlans: mealPlans.map(plan => ({
        id: plan.id,
        userId: plan.userId,
        date: dateToISODate(plan.date),
        meals: plan.meals,
        macros: plan.macros,
        source: plan.source,
        createdAt: plan.createdAt.toISOString(),
      })),
      source: 'db',
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Meal plan generation failed';
}
