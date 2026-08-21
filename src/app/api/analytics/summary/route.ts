import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsDashboard } from '@/lib/analytics/queries';
import { requireAdmin } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const authResponse = requireAdmin(request);
  if (authResponse) return authResponse;
  const days = Number(request.nextUrl.searchParams.get('days') || 30);

  try {
    const summary = await getAnalyticsDashboard(days);
    return NextResponse.json({ summary, source: 'db' });
  } catch (error) {
    return NextResponse.json({
      summary: null,
      source: 'db',
      warning: getErrorMessage(error),
    }, { status: 500 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Analytics data is temporarily unavailable.';
}
