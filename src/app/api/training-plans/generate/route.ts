import { NextRequest, NextResponse } from 'next/server';
import { generateTrainingPlan } from '@/lib/coach';
import { dateToISODate } from '@/lib/server-mappers';

interface GenerateTrainingPlanBody {
  userId?: string;
  startDate?: string;
  days?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateTrainingPlanBody;
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const plan = await generateTrainingPlan(body.userId, body.startDate || dateToISODate(new Date()), body.days || 7);
    return NextResponse.json({
      trainingPlan: {
        id: plan.id,
        userId: plan.userId,
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
