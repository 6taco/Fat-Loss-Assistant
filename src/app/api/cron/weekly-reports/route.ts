import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { dateToISODate } from '@/lib/server-mappers';
import { generateWeeklyReport, getPreviousClosedWeekIndex } from '@/lib/weekly-report';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  const querySecret = request.nextUrl.searchParams.get('secret');

  if (secret && auth !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const users = await prisma.user.findMany({ select: { id: true, startDate: true } });
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const weekIndex = getPreviousClosedWeekIndex(dateToISODate(user.startDate));
    if (!weekIndex) {
      skipped += 1;
      continue;
    }

    try {
      const before = await prisma.weeklyReport.findUnique({
        where: { userId_weekIndex: { userId: user.id, weekIndex } },
      });
      await generateWeeklyReport(user.id, weekIndex, false);
      if (before) skipped += 1;
      else generated += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ generated, skipped, failed });
}
