export type AnalyticsEventName =
  | 'app_open'
  | 'session_start'
  | 'session_end'
  | 'sign_up'
  | 'onboarding_start'
  | 'onboarding_complete'
  | 'plan_generate'
  | 'plan_complete'
  | 'weight_log_create'
  | 'meal_log_create'
  | 'photo_upload'
  | 'daily_report_view'
  | 'weekly_report_view'
  | 'ai_chat_send'
  | 'ai_chat_reply'
  | 'coach_feed_view'
  | 'coach_feed_click'
  | 'proposal_view'
  | 'proposal_accept'
  | 'proposal_dismiss'
  | 'proposal_edit'
  | 'proposal_expire'
  | 'strategy_recommend_view'
  | 'strategy_recommend_accept'
  | 'strategy_recommend_dismiss'
  | 'strategy_switch_proposed'
  | 'strategy_switch_accept'
  | 'strategy_day_goal_complete'
  | 'fasting_window_complete'
  | 'strategy_plateau_adjustment_proposed'
  | 'binge_risk_detected';

export interface AnalyticsContext {
  platform?: 'ios' | 'android' | 'desktop' | 'unknown';
  device?: 'mobile' | 'tablet' | 'desktop';
  appVersion?: string;
  timezone?: string;
  locale?: string;
  isPwa?: boolean;
  screenWidth?: number;
  screenHeight?: number;
  browser?: string;
}

export interface AnalyticsEventPayload {
  eventId?: string;
  eventName: AnalyticsEventName;
  eventVersion?: number;
  userId?: string | null;
  anonymousId?: string;
  sessionId?: string;
  occurredAt?: string;
  clientTs?: number;
  route?: string;
  source?: 'web' | 'pwa' | 'api';
  pageRef?: string;
  properties?: Record<string, unknown>;
  context?: AnalyticsContext;
}

export interface AnalyticsEventEnvelope extends Required<Pick<AnalyticsEventPayload, 'eventName'>> {
  eventId: string;
  eventVersion: number;
  userId: string | null;
  anonymousId: string;
  sessionId: string;
  occurredAt: string;
  clientTs: number;
  route: string;
  source: 'web' | 'pwa' | 'api';
  pageRef: string;
  properties: Record<string, unknown>;
  context: AnalyticsContext;
}
