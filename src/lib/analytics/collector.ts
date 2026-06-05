import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import type { AnalyticsEventEnvelope, AnalyticsEventName } from '@/lib/analytics/types';

export async function ingestAnalyticsEvents(events: AnalyticsEventEnvelope[]) {
  if (!events.length) return { inserted: 0 };

  const prisma = getPrisma();
  const normalized = dedupeEventsById(events.map(normalizeEvent));
  const existingEvents = await prisma.analyticsEvent.findMany({
    where: { eventId: { in: normalized.map(event => event.eventId) } },
    select: { eventId: true },
  });
  const existingEventIds = new Set(existingEvents.map(event => event.eventId));
  const writable = normalized.filter(event => !existingEventIds.has(event.eventId));

  if (!writable.length) return { inserted: 0, received: normalized.length };

  const created = await prisma.analyticsEvent.createMany({
    data: writable.map(event => ({
      eventId: event.eventId,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      userId: event.userId || null,
      anonymousId: event.anonymousId,
      sessionId: event.sessionId,
      occurredAt: new Date(event.occurredAt),
      clientTs: BigInt(event.clientTs),
      route: event.route,
      source: event.source,
      pageRef: event.pageRef,
      properties: event.properties as unknown as Prisma.InputJsonValue,
      context: event.context as unknown as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });

  return { inserted: created.count, received: normalized.length };
}

function normalizeEvent(event: AnalyticsEventEnvelope): AnalyticsEventEnvelope {
  return {
    ...event,
    eventVersion: event.eventVersion || 1,
    userId: event.userId || null,
    anonymousId: event.anonymousId || 'anonymous',
    sessionId: event.sessionId || 'session',
    occurredAt: event.occurredAt || new Date().toISOString(),
    clientTs: event.clientTs || Date.now(),
    route: event.route || '/',
    source: event.source || 'web',
    pageRef: event.pageRef || 'root',
    properties: event.properties || {},
    context: event.context || {},
  };
}

function dedupeEventsById(events: AnalyticsEventEnvelope[]) {
  return Array.from(new Map(events.map(event => [event.eventId, event])).values());
}

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === 'string' && [
    'app_open',
    'session_start',
    'session_end',
    'sign_up',
    'onboarding_start',
    'onboarding_complete',
    'plan_generate',
    'plan_complete',
    'weight_log_create',
    'meal_log_create',
    'photo_upload',
    'daily_report_view',
    'weekly_report_view',
    'ai_chat_send',
    'ai_chat_reply',
    'coach_feed_view',
    'coach_feed_click',
    'proposal_view',
    'proposal_accept',
    'proposal_dismiss',
    'proposal_edit',
    'proposal_expire',
    'strategy_recommend_view',
    'strategy_recommend_accept',
    'strategy_recommend_dismiss',
    'strategy_switch_proposed',
    'strategy_switch_accept',
    'strategy_day_goal_complete',
    'fasting_window_complete',
    'strategy_plateau_adjustment_proposed',
    'binge_risk_detected',
  ].includes(value);
}
