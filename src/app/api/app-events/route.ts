import { NextRequest, NextResponse } from 'next/server';
import { ingestAnalyticsEvents, isAnalyticsEventName } from '@/lib/analytics/collector';
import type { AnalyticsEventEnvelope } from '@/lib/analytics/types';
import { enforceRateLimit } from '@/lib/auth/rate-limit';
import { getRequestIp } from '@/lib/auth/request';
import { getRouteErrorMessage } from '@/lib/route-helpers';

interface EventsBody {
  events?: AnalyticsEventEnvelope[];
}

export async function POST(request: NextRequest) {
  // Anonymous tracking is by design, so the endpoint stays unauthenticated —
  // bound it per IP instead to stop unbounded fake-event floods.
  try {
    await enforceRateLimit({ action: 'analytics-events-ip', identifier: getRequestIp(request), limit: 30, windowMs: 60_000 });
  } catch (error) {
    const status = (error as { status?: number })?.status ?? 500;
    return NextResponse.json({ inserted: 0, warning: 'RATE_LIMITED' }, { status: status === 429 ? 429 : 500 });
  }

  const body = (await request.json()) as EventsBody;
  const events = Array.isArray(body.events) ? body.events.filter(isValidEvent) : [];

  if (!events.length) {
    return NextResponse.json({ inserted: 0, source: 'client', warning: 'No valid analytics events.' }, { status: 400 });
  }

  try {
    const result = await ingestAnalyticsEvents(events.slice(0, 50));
    return NextResponse.json({ ...result, source: 'db' });
  } catch (error) {
    return NextResponse.json({ inserted: 0, source: 'db', warning: getRouteErrorMessage(error, 'Analytics event write failed.') }, { status: 500 });
  }
}

function isValidEvent(event: Partial<AnalyticsEventEnvelope>): event is AnalyticsEventEnvelope {
  return Boolean(
    event.eventId &&
    isAnalyticsEventName(event.eventName) &&
    event.anonymousId &&
    event.sessionId &&
    event.occurredAt,
  );
}

