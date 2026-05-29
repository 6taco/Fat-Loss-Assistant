type ReportNotificationType = 'daily_report' | 'weekly_report';
type ReportNotificationStatus = 'sent';

export interface BuiltReportNotification {
  userId: string;
  type: ReportNotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown> & { reportId: string };
  status: ReportNotificationStatus;
  scheduledAt: Date;
  sentAt: Date;
}

export function buildDailyReportNotification(input: {
  userId: string;
  reportId: string;
  date: string;
  score: number;
  sentAt?: Date;
}): BuiltReportNotification;

export function buildWeeklyReportNotification(input: {
  userId: string;
  reportId: string;
  weekIndex: number;
  startDate: string;
  endDate: string;
  score: number;
  sentAt?: Date;
}): BuiltReportNotification;

export function getReportNotificationKey(notification: Pick<BuiltReportNotification, 'type' | 'payload'>): string;
