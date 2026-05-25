import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { weeklyReportToResponse } from '@/lib/server-mappers';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const weekIndexParam = request.nextUrl.searchParams.get('weekIndex');
  const limitParam = request.nextUrl.searchParams.get('limit');
  const weekIndex = weekIndexParam ? Number.parseInt(weekIndexParam, 10) : undefined;
  const limit = Math.max(1, Math.min(24, Number.parseInt(limitParam || '8', 10) || 8));

  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const reports = await prisma.weeklyReport.findMany({
      where: {
        userId,
        ...(weekIndex ? { weekIndex } : {}),
      },
      orderBy: { weekIndex: 'desc' },
      take: weekIndex ? 1 : limit,
    });

    return NextResponse.json({ reports: reports.map(weeklyReportToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ reports: [], source: 'local', warning: getErrorMessage(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
