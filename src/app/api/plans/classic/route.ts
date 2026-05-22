import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { dayPlanToResponse } from '@/lib/server-mappers';
import { mockPlan } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ plans: mockPlan, source: 'mock' });
  }

  try {
    const prisma = getPrisma();
    const plans = await prisma.dayPlan.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ plans: plans.map(dayPlanToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), plans: mockPlan, source: 'fallback' }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
