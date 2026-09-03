import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { weeklyReportToResponse } from '@/lib/server-mappers';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

export async function GET(request: NextRequest) {
  const requestedUserId = request.nextUrl.searchParams.get('userId');
  const weekIndexParam = request.nextUrl.searchParams.get('weekIndex');
  const limitParam = request.nextUrl.searchParams.get('limit');
  const weekIndex = weekIndexParam ? Number.parseInt(weekIndexParam, 10) : undefined;
  const limit = Math.max(1, Math.min(24, Number.parseInt(limitParam || '8', 10) || 8));

  const auth = await requireBusinessUser(request, requestedUserId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

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
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed'), reports: [] }, { status: 503 });
  }
}

