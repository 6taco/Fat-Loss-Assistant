import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import type { AnalyticsEventEnvelope, AnalyticsEventName } from '@/lib/analytics/types';

export async function ingestAnalyticsEvents(events: AnalyticsEventEnvelope[]) {
  if (!events.length) return { inserted: 0 };

  const prisma = getPrisma();
  const normalized = dedupeEventsById(events.map(normalizeEvent));
  const userIds = new Set<string>();
  const anonymousIds = new Set<string>();
  const dayBuckets = new Map<string, AnalyticsEventEnvelope[]>();
  const sessionBuckets = new Map<string, AnalyticsEventEnvelope[]>();

  for (const event of normalized) {
    if (event.userId) userIds.add(event.userId);
    anonymousIds.add(event.anonymousId);
    const day = event.occurredAt.slice(0, 10);
    if (!dayBuckets.has(day)) dayBuckets.set(day, []);
    dayBuckets.get(day)!.push(event);
    if (!sessionBuckets.has(event.sessionId)) sessionBuckets.set(event.sessionId, []);
    sessionBuckets.get(event.sessionId)!.push(event);
  }

  const inserted = await prisma.$transaction(async (tx) => {
    const created = await tx.analyticsEvent.createMany({
      data: normalized.map(event => ({
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

    for (const event of normalized) {
      await upsertIdentity(tx, event);
      await upsertLifecycle(tx, event);
    }

    for (const [sessionId, bucket] of sessionBuckets.entries()) {
      await upsertSession(tx, sessionId, bucket);
    }

    for (const [date, bucket] of dayBuckets.entries()) {
      await upsertDailyAggregates(tx, date, bucket);
    }
    return created.count;
  });

  return { inserted, received: normalized.length };
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

async function upsertIdentity(
  tx: Prisma.TransactionClient,
  event: AnalyticsEventEnvelope,
) {
  const existing = await tx.analyticsIdentity.findUnique({ where: { anonymousId: event.anonymousId } });
  await tx.analyticsIdentity.upsert({
    where: { anonymousId: event.anonymousId },
    create: {
      anonymousId: event.anonymousId,
      userId: event.userId || null,
      firstUserAt: event.userId ? new Date(event.occurredAt) : null,
      lastUserAt: event.userId ? new Date(event.occurredAt) : null,
    },
    update: {
      userId: event.userId || existing?.userId || null,
      lastUserAt: event.userId ? new Date(event.occurredAt) : existing?.lastUserAt || null,
      firstUserAt: existing?.firstUserAt || (event.userId ? new Date(event.occurredAt) : null),
    },
  });
}

async function upsertSession(
  tx: Prisma.TransactionClient,
  sessionId: string,
  events: AnalyticsEventEnvelope[],
) {
  const ordered = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const startEvent = ordered.find(event => event.eventName === 'session_start') || ordered[0];
  const endEvent = [...ordered].reverse().find(event => event.eventName === 'session_end') || ordered[ordered.length - 1];
  const startedAt = new Date(startEvent.occurredAt);
  const endedAt = new Date(endEvent.occurredAt);
  const firstUserEvent = ordered.find(event => event.userId);

  await tx.analyticsSession.upsert({
    where: { sessionId },
    create: {
      sessionId,
      userId: firstUserEvent?.userId || null,
      anonymousId: ordered[0].anonymousId,
      startedAt,
      endedAt,
      durationMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
      route: startEvent.route,
      source: startEvent.source,
    },
    update: {
      userId: firstUserEvent?.userId || null,
      anonymousId: ordered[0].anonymousId,
      startedAt,
      endedAt,
      durationMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
      route: startEvent.route,
      source: startEvent.source,
    },
  });
}

async function upsertDailyAggregates(
  tx: Prisma.TransactionClient,
  date: string,
  events: AnalyticsEventEnvelope[],
) {
  const eventNames = new Set(events.map(event => event.eventName));
  for (const eventName of eventNames) {
    const bucket = events.filter(event => event.eventName === eventName);
    const uniqueUsers = new Set(bucket.map(event => event.userId).filter(Boolean));
    const uniqueAnonymous = new Set(bucket.map(event => event.anonymousId));
    const existing = await tx.analyticsDailyAggregate.findUnique({
      where: {
        date_eventName: {
          date: new Date(`${date}T00:00:00`),
          eventName,
        },
      },
    });

    await tx.analyticsDailyAggregate.upsert({
      where: {
        date_eventName: {
          date: new Date(`${date}T00:00:00`),
          eventName,
        },
      },
      create: {
        date: new Date(`${date}T00:00:00`),
        eventName,
        eventCount: bucket.length,
        userCount: uniqueUsers.size,
        sessionCount: new Set(bucket.map(event => event.sessionId)).size,
        uniqueAnonymous: uniqueAnonymous.size,
        properties: {
          routeCount: new Set(bucket.map(event => event.route)).size,
        },
      },
      update: {
        eventCount: (existing?.eventCount || 0) + bucket.length,
        userCount: Math.max(existing?.userCount || 0, uniqueUsers.size),
        sessionCount: Math.max(existing?.sessionCount || 0, new Set(bucket.map(event => event.sessionId)).size),
        uniqueAnonymous: Math.max(existing?.uniqueAnonymous || 0, uniqueAnonymous.size),
        properties: {
          routeCount: new Set(bucket.map(event => event.route)).size,
        },
      },
    });
  }
}

async function upsertLifecycle(
  tx: Prisma.TransactionClient,
  event: AnalyticsEventEnvelope,
) {
  if (!event.userId) return;
  const now = new Date(event.occurredAt);
  const updates: Record<string, Date> = {};

  if (event.eventName === 'sign_up') updates.registeredAt = now;
  if (event.eventName === 'onboarding_complete') updates.onboardingCompletedAt = now;
  if (event.eventName === 'plan_generate') updates.firstPlanGeneratedAt = now;
  if (event.eventName === 'weight_log_create') updates.firstWeightLoggedAt = now;
  if (event.eventName === 'meal_log_create') updates.firstMealLoggedAt = now;
  if (event.eventName === 'photo_upload') updates.firstPhotoUploadedAt = now;
  if (event.eventName === 'daily_report_view') updates.firstDailyReportViewAt = now;
  if (event.eventName === 'weekly_report_view') updates.firstWeeklyReportViewAt = now;
  if (event.eventName === 'ai_chat_send') updates.firstAiChatAt = now;
  if (event.eventName === 'coach_feed_view') updates.firstCoachFeedViewAt = now;
  if (event.eventName === 'proposal_accept') updates.firstProposalAcceptAt = now;

  await tx.analyticsUserLifecycle.upsert({
    where: { userId: event.userId },
    create: {
      userId: event.userId,
      anonymousId: event.anonymousId,
      ...updates,
    },
    update: {
      anonymousId: event.anonymousId,
      ...updates,
    },
  });
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
