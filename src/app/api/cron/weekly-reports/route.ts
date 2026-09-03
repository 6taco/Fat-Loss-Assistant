import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { upsertSentReportNotification } from '@/lib/report-notification-store';
import { buildWeeklyReportNotification } from '@/lib/report-notifications';
import { dateToISODate } from '@/lib/server-mappers';
import { generateWeeklyReport, getPreviousClosedWeekIndex } from '@/lib/weekly-report';
import { requireCron } from '@/lib/auth-server';
import { mapWithConcurrency } from '@/lib/concurrency';

// One LLM call per user; workers spend most of their time awaiting it, so a
// small concurrency keeps the default 2-connection DB pool saturated without
// overloading it.
const USER_CONCURRENCY = 3;

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authResponse = requireCron(request);
  if (authResponse) return authResponse;

  const prisma = getPrisma();
  const users = await prisma.user.findMany({ select: { id: true, startDate: true } });
  let generated = 0;
  let skipped = 0;
  let notified = 0;

  const results = await mapWithConcurrency(users, USER_CONCURRENCY, async user => {
    const weekIndex = getPreviousClosedWeekIndex(dateToISODate(user.startDate));
    if (!weekIndex) {
      skipped += 1;
      return;
    }

    const before = await prisma.weeklyReport.findUnique({
      where: { userId_weekIndex: { userId: user.id, weekIndex } },
    });
    const report = await generateWeeklyReport(user.id, weekIndex, false);
    await upsertSentReportNotification(buildWeeklyReportNotification({
      userId: user.id,
      reportId: report.id,
      weekIndex: report.weekIndex,
      startDate: report.startDate,
      endDate: report.endDate,
      score: report.score,
    }));
    notified += 1;
    if (before) skipped += 1;
    else generated += 1;
  });

  const failed = results.filter(result => result.status === 'rejected').length;
  return NextResponse.json({ generated, skipped, notified, failed });
}
