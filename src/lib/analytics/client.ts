'use client';

import { getItem, setItem } from '@/lib/storage';
import type { AnalyticsEventEnvelope, AnalyticsEventName, AnalyticsEventPayload } from '@/lib/analytics/types';

const STORAGE_KEY = 'fla_analytics_queue';
const ANON_KEY = 'fla_analytics_anonymous_id';
const SESSION_KEY = 'fla_analytics_session_id';
const LAST_ACTIVITY_KEY = 'fla_analytics_last_activity';
const IDENTITY_KEY = 'fla_analytics_user_id';
const BATCH_SIZE = 20;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ENDPOINT = '/api/analytics/events';

let flushTimer: number | null = null;
let pageRoute = '/';

export function initAnalytics(route: string) {
  pageRoute = route;
  ensureAnonymousId();
  ensureSession();
  track('app_open', { route });
  startHeartbeat();
}

export function setAnalyticsRoute(route: string) {
  pageRoute = route;
  touchSession();
}

export function identifyAnalyticsUser(userId: string | null | undefined) {
  if (!userId) return;
  setItem(IDENTITY_KEY, userId);
}

export function track(eventName: AnalyticsEventName, properties: Record<string, unknown> = {}, overrides: Partial<AnalyticsEventPayload> = {}) {
  if (typeof window === 'undefined') return;

  const payload: AnalyticsEventEnvelope = {
    eventId: overrides.eventId || crypto.randomUUID?.() || `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    eventName,
    eventVersion: overrides.eventVersion || 1,
    userId: overrides.userId ?? getStoredUserId(),
    anonymousId: overrides.anonymousId ?? ensureAnonymousId(),
    sessionId: overrides.sessionId ?? ensureSession(),
    occurredAt: overrides.occurredAt || new Date().toISOString(),
    clientTs: overrides.clientTs || Date.now(),
    route: overrides.route || pageRoute,
    source: overrides.source || inferSource(),
    pageRef: overrides.pageRef || pageRefFromRoute(pageRoute),
    properties,
    context: overrides.context || collectContext(),
  };

  const queue = readQueue();
  queue.push(payload);
  writeQueue(queue);
  scheduleFlush();
}

export async function flush() {
  if (typeof window === 'undefined') return;
  const queue = readQueue();
  if (!queue.length) return;

  const chunk = queue.slice(0, BATCH_SIZE);
  try {
    const sent = await sendBatch(chunk);
    if (!sent) return;
    writeQueue(queue.slice(chunk.length));
  } catch {
    // keep queue for retry
  }
}

export function recordPageView(route: string) {
  setAnalyticsRoute(route);
  track('app_open', { route, page_view: true });
}

export function markSessionActivity() {
  touchSession();
}

function inferSource(): 'web' | 'pwa' | 'api' {
  return isStandaloneMode() ? 'pwa' : 'web';
}

function collectContext() {
  if (typeof window === 'undefined') return {};
  return {
    platform: detectPlatform(),
    device: detectDevice(),
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'local',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
    isPwa: isStandaloneMode(),
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    browser: navigator.userAgent,
  };
}

function detectPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/mac|win|linux/.test(ua)) return 'desktop';
  return 'unknown';
}

function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function pageRefFromRoute(route: string) {
  return route.replace(/^\//, '') || 'root';
}

function ensureAnonymousId() {
  const existing = getItem<string | null>(ANON_KEY, null);
  if (existing) return existing;
  const next = crypto.randomUUID?.() || `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setItem(ANON_KEY, next);
  return next;
}

function ensureSession() {
  const sessionId = getItem<string | null>(SESSION_KEY, null);
  const lastActivity = Number(getItem<string | null>(LAST_ACTIVITY_KEY, null) || 0);
  if (sessionId && Date.now() - lastActivity < SESSION_TIMEOUT_MS) {
    touchSession();
    return sessionId;
  }

  const nextSession = crypto.randomUUID?.() || `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setItem(SESSION_KEY, nextSession);
  touchSession();
  track('session_start', {});
  return nextSession;
}

function touchSession() {
  setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

function getStoredUserId() {
  return getItem<string | null>(IDENTITY_KEY, null);
}

function readQueue(): AnalyticsEventEnvelope[] {
  return getItem<AnalyticsEventEnvelope[]>(STORAGE_KEY, []);
}

function writeQueue(queue: AnalyticsEventEnvelope[]) {
  setItem(STORAGE_KEY, queue);
}

function scheduleFlush() {
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    void flush();
  }, 1000);
}

async function sendBatch(batch: AnalyticsEventEnvelope[]) {
  const body = JSON.stringify({ events: batch });
  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    if (ok) return true;
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  });
  return response.ok;
}

export function startHeartbeat() {
  if (typeof window === 'undefined') return;
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('beforeunload', () => {
    void flush();
  });
  window.addEventListener('focus', touchSession);
  window.addEventListener('click', touchSession, { passive: true });
  window.addEventListener('keydown', touchSession, { passive: true });
}
