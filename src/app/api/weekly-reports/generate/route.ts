import { NextRequest, NextResponse } from 'next/server';
import { WeeklyReportNotReadyError, generateWeeklyReport } from '@/lib/weekly-report';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

interface GenerateWeeklyReportBody {
  userId?: string;
  weekIndex?: number;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateWeeklyReportBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;

  try {
    const report = await generateWeeklyReport(auth.context.userId!, body.weekIndex, Boolean(body.force));
    return NextResponse.json({ report, source: 'db' });
  } catch (error) {
    if (error instanceof WeeklyReportNotReadyError) {
      return NextResponse.json({ error: error.message, code: 'WEEKLY_REPORT_NOT_READY' }, { status: 409 });
    }
    return NextResponse.json({ report: null, source: 'db', warning: getRouteErrorMessage(error, 'Weekly report generation failed') }, { status: 503 });
  }
}

