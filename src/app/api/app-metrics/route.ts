import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsDashboard } from '@/lib/analytics/queries';
import { requireAdmin } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

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
      warning: getRouteErrorMessage(error, 'Analytics data is temporarily unavailable.'),
    }, { status: 500 });
  }
}

