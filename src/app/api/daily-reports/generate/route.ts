import { NextRequest, NextResponse } from 'next/server';
import { DailyReportNotReadyError, generateDailyReport, getReportDateForCron } from '@/lib/daily-report';

interface GenerateDailyReportBody {
  userId?: string;
  date?: string;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateDailyReportBody;
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const report = await generateDailyReport(body.userId, body.date || getReportDateForCron(), Boolean(body.force));
    return NextResponse.json({ report, source: 'db' });
  } catch (error) {
    if (error instanceof DailyReportNotReadyError) {
      return NextResponse.json({ error: error.message, code: 'REPORT_NOT_READY' }, { status: 409 });
    }
    return NextResponse.json({ report: null, source: 'local', warning: getErrorMessage(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Daily report generation failed';
}
