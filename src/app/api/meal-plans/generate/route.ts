import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateMealPlans } from '@/lib/coach';
import { dateToISODate } from '@/lib/server-mappers';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage, parseJsonBody } from '@/lib/route-helpers';

const bodySchema = z.object({
  userId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD').optional(),
  days: z.number().int().min(1).max(14).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const mealPlans = await generateMealPlans(userId, body.startDate || dateToISODate(new Date()), body.days || 3);
    return NextResponse.json({
      mealPlans: mealPlans.map(plan => ({
        id: plan.id,
        userId,
        date: dateToISODate(plan.date),
        meals: plan.meals,
        macros: plan.macros,
        source: plan.source,
        createdAt: plan.createdAt.toISOString(),
      })),
      source: 'db',
    });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Meal plan generation failed') }, { status: 500 });
  }
}
