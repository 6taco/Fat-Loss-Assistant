import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { dayPlanToResponse } from '@/lib/server-mappers';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage, getQueryLimit } from '@/lib/route-helpers';

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
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed'), plans: [], source: 'db' }, { status: 503 });
  }
}
