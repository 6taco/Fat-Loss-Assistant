import { NextRequest, NextResponse } from 'next/server';
import { generateTrainingPlan } from '@/lib/coach';
import { dateToISODate } from '@/lib/server-mappers';
import { requireBusinessUser } from '@/lib/auth-server';

interface GenerateTrainingPlanBody {
  userId?: string;
  startDate?: string;
  days?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateTrainingPlanBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const plan = await generateTrainingPlan(userId, body.startDate || dateToISODate(new Date()), body.days || 7);
    return NextResponse.json({
      trainingPlan: {
        id: plan.id,
        userId,
        startDate: dateToISODate(plan.startDate),
        endDate: dateToISODate(plan.endDate),
        days: plan.days,
        source: plan.source,
        createdAt: plan.createdAt.toISOString(),
      },
      source: 'db',
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Training plan generation failed';
}
