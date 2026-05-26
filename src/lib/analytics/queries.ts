import { getPrisma } from '@/lib/prisma';

const ACTIVE_EVENTS = [
  'app_open',
  'weight_log_create',
  'meal_log_create',
  'ai_chat_send',
  'daily_report_view',
  'coach_feed_view',
];

export async function getAnalyticsDashboard(days = 30) {
  const prisma = getPrisma();
  const end = startOfDay(new Date());
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(1, days - 1));

  const events = await prisma.analyticsEvent.findMany({
    where: { occurredAt: { gte: start, lt: addDays(end, 1) } },
    select: {
      eventName: true,
      userId: true,
      anonymousId: true,
      sessionId: true,
      occurredAt: true,
      source: true,
      context: true,
    },
    orderBy: { occurredAt: 'asc' },
    take: 50000,
  });

  const todayEvents = events.filter(event => sameDay(event.occurredAt, end));
  const activeUsers = uniqueActors(events.filter(event => ACTIVE_EVENTS.includes(event.eventName)));
  const todayActiveUsers = uniqueActors(todayEvents.filter(event => ACTIVE_EVENTS.includes(event.eventName)));

  return {
    kpis: {
      dau: todayActiveUsers,
      wau: uniqueActors(events.filter(event => event.occurredAt >= addDays(end, -6) && ACTIVE_EVENTS.includes(event.eventName))),
      signUps: count(events, 'sign_up'),
      onboardingCompleted: count(events, 'onboarding_complete'),
      d1Retention: retention(events, 'sign_up', 1),
      d7Retention: retention(events, 'sign_up', 7),
      checkInRate: rate(uniqueActors(events.filter(event => ['weight_log_create', 'meal_log_create'].includes(event.eventName))), activeUsers),
      aiUsageRate: rate(uniqueActors(events.filter(event => ['ai_chat_send', 'daily_report_view', 'weekly_report_view'].includes(event.eventName))), activeUsers),
      proposalAcceptRate: rate(count(events, 'proposal_accept'), count(events, 'proposal_view')),
    },
    funnel: buildFunnel(events),
    trends: buildTrends(events, start, days),
    retention: buildRetention(events),
    proposal: {
      viewed: count(events, 'proposal_view'),
      accepted: count(events, 'proposal_accept'),
      dismissed: count(events, 'proposal_dismiss'),
      edited: count(events, 'proposal_edit'),
    },
    platforms: platformBreakdown(events),
  };
}

function buildFunnel(events: Array<{ eventName: string; userId: string | null; anonymousId: string }>) {
  const steps = [
    ['sign_up'],
    ['onboarding_complete'],
    ['plan_generate'],
    ['weight_log_create', 'meal_log_create'],
    ['ai_chat_send'],
    ['daily_report_view'],
    ['coach_feed_view'],
    ['proposal_view'],
    ['proposal_accept'],
  ];
  return steps.map((names, index) => ({
    step: index + 1,
    eventNames: names,
    users: uniqueActors(events.filter(event => names.includes(event.eventName))),
  }));
}

function buildTrends(events: Array<{ eventName: string; occurredAt: Date }>, start: Date, days: number) {
  const names = ['app_open', 'weight_log_create', 'meal_log_create', 'ai_chat_send', 'daily_report_view', 'weekly_report_view', 'coach_feed_view'];
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    const bucket = events.filter(event => sameDay(event.occurredAt, date));
    return {
      date: toDateKey(date),
      ...Object.fromEntries(names.map(name => [name, count(bucket, name)])),
    };
  });
}

function buildRetention(events: Array<{ eventName: string; userId: string | null; anonymousId: string; occurredAt: Date }>) {
  return [1, 7].map(day => ({
    day,
    signUp: retention(events, 'sign_up', day),
    onboarding: retention(events, 'onboarding_complete', day),
    plan: retention(events, 'plan_generate', day),
  }));
}

function platformBreakdown(events: Array<{ context: unknown }>) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const platform = event.context && typeof event.context === 'object' && 'platform' in event.context
      ? String((event.context as { platform?: unknown }).platform || 'unknown')
      : 'unknown';
    counts.set(platform, (counts.get(platform) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([platform, count]) => ({ platform, count }));
}

function retention(
  events: Array<{ eventName: string; userId: string | null; anonymousId: string; occurredAt: Date }>,
  cohortEvent: string,
  dayOffset: number,
) {
  const cohort = events.filter(event => event.eventName === cohortEvent);
  if (!cohort.length) return 0;
  let retained = 0;
  for (const event of cohort) {
    const actor = actorId(event);
    const target = addDays(startOfDay(event.occurredAt), dayOffset);
    const hasReturn = events.some(candidate =>
      actorId(candidate) === actor &&
      ACTIVE_EVENTS.includes(candidate.eventName) &&
      sameDay(candidate.occurredAt, target),
    );
    if (hasReturn) retained += 1;
  }
  return Math.round(retained / cohort.length * 100);
}

function count(events: Array<{ eventName: string }>, eventName: string) {
  return events.filter(event => event.eventName === eventName).length;
}

function uniqueActors(events: Array<{ userId: string | null; anonymousId: string }>) {
  return new Set(events.map(actorId)).size;
}

function actorId(event: { userId: string | null; anonymousId: string }) {
  return event.userId || event.anonymousId;
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round(numerator / denominator * 100);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

