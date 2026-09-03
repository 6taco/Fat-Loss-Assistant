import { NextRequest, NextResponse } from 'next/server';
import { DailyReportNotReadyError, generateDailyReport, getReportDateForCron } from '@/lib/daily-report';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

interface GenerateDailyReportBody {
  userId?: string;
  date?: string;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateDailyReportBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;

  try {
    const report = await generateDailyReport(auth.context.userId!, body.date || getReportDateForCron(), Boolean(body.force));
    return NextResponse.json({ report, source: 'db' });
  } catch (error) {
    if (error instanceof DailyReportNotReadyError) {
      return NextResponse.json({ error: error.message, code: 'REPORT_NOT_READY' }, { status: 409 });
    }
    return NextResponse.json({ report: null, source: 'db', warning: getRouteErrorMessage(error, 'Daily report generation failed') }, { status: 503 });
  }
}

