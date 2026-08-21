import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { dailyReportToResponse, toDate } from '@/lib/server-mappers';
import { requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const requestedUserId = request.nextUrl.searchParams.get('userId');
  const date = request.nextUrl.searchParams.get('date');
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = Math.max(1, Math.min(30, Number.parseInt(limitParam || '7', 10) || 7));

  const auth = await requireBusinessUser(request, requestedUserId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const reports = await prisma.dailyReport.findMany({
      where: {
        userId,
        ...(date ? { date: toDate(date) } : {}),
      },
      orderBy: { date: 'desc' },
      take: date ? 1 : limit,
    });

    return NextResponse.json({ reports: reports.map(dailyReportToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), reports: [] }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
