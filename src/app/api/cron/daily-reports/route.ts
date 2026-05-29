import { NextRequest, NextResponse } from 'next/server';
import { generateDailyReport, getReportDateForCron } from '@/lib/daily-report';
import { getPrisma } from '@/lib/prisma';
import { upsertSentReportNotification } from '@/lib/report-notification-store';
import { buildDailyReportNotification } from '@/lib/report-notifications';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  const querySecret = request.nextUrl.searchParams.get('secret');

  if (secret && auth !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get('date') || getReportDateForCron();
  const prisma = getPrisma();
  const users = await prisma.user.findMany({ select: { id: true } });
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let notified = 0;

  for (const user of users) {
    try {
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
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ date, generated, skipped, notified, failed });
}
