import { NextRequest, NextResponse } from 'next/server';
import { generateDailyReport, getReportDateForCron } from '@/lib/daily-report';
import { getPrisma } from '@/lib/prisma';
import { upsertSentReportNotification } from '@/lib/report-notification-store';
import { buildDailyReportNotification } from '@/lib/report-notifications';
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

  const date = request.nextUrl.searchParams.get('date') || getReportDateForCron();
  const prisma = getPrisma();
  const users = await prisma.user.findMany({ select: { id: true } });
  let generated = 0;
  let skipped = 0;
  let notified = 0;

  const results = await mapWithConcurrency(users, USER_CONCURRENCY, async user => {
    const before = await prisma.dailyReport.findUnique({
      where: { userId_date: { userId: user.id, date: new Date(`${date}T00:00:00`) } },
    });
    const report = await generateDailyReport(user.id, date, false);
    await upsertSentReportNotification(buildDailyReportNotification({
      userId: user.id,
      reportId: report.id,
      date: report.date,
      score: report.score,
    }));
    notified += 1;
    if (before) skipped += 1;
    else generated += 1;
  });

  const failed = results.filter(result => result.status === 'rejected').length;
  return NextResponse.json({ date, generated, skipped, notified, failed });
}
