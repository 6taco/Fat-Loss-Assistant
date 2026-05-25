import { NextRequest, NextResponse } from 'next/server';
import { WeeklyReportNotReadyError, generateWeeklyReport } from '@/lib/weekly-report';

interface GenerateWeeklyReportBody {
  userId?: string;
  weekIndex?: number;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateWeeklyReportBody;
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const report = await generateWeeklyReport(body.userId, body.weekIndex, Boolean(body.force));
    return NextResponse.json({ report, source: 'db' });
  } catch (error) {
    if (error instanceof WeeklyReportNotReadyError) {
      return NextResponse.json({ error: error.message, code: 'WEEKLY_REPORT_NOT_READY' }, { status: 409 });
    }
    return NextResponse.json({ report: null, source: 'local', warning: getErrorMessage(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Weekly report generation failed';
}
