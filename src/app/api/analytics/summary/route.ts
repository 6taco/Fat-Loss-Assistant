import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsDashboard } from '@/lib/analytics/queries';

export async function GET(request: NextRequest) {
  const days = Number(request.nextUrl.searchParams.get('days') || 30);

  try {
    const summary = await getAnalyticsDashboard(days);
    return NextResponse.json({ summary, source: 'db' });
  } catch (error) {
    return NextResponse.json({
      summary: null,
      source: 'local',
      warning: getErrorMessage(error),
    });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '分析数据暂时不可用';
}

