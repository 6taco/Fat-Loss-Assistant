import { NextRequest, NextResponse } from 'next/server';
import { ingestAnalyticsEvents, isAnalyticsEventName } from '@/lib/analytics/collector';
import type { AnalyticsEventEnvelope } from '@/lib/analytics/types';

interface EventsBody {
  events?: AnalyticsEventEnvelope[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as EventsBody;
  const events = Array.isArray(body.events) ? body.events.filter(isValidEvent) : [];

  if (!events.length) {
    return NextResponse.json({ inserted: 0, source: 'client', warning: 'No valid analytics events.' }, { status: 400 });
  }

  try {
    const result = await ingestAnalyticsEvents(events.slice(0, 50));
    return NextResponse.json({ ...result, source: 'db' });
  } catch (error) {
    return NextResponse.json({ inserted: 0, source: 'db', warning: getErrorMessage(error) }, { status: 500 });
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Analytics event write failed.';
}
