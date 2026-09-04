type ReportNotificationType = 'daily_report' | 'weekly_report';

export interface BuiltReportNotification {
  userId: string;
  type: ReportNotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown> & { reportId: string };
  status: 'sent';
  scheduledAt: Date;
  sentAt: Date;
}

export function buildDailyReportNotification({ userId, reportId, date, score, sentAt = new Date() }: {
  userId: string;
  reportId: string;
  date: string;
  score: number;
  sentAt?: Date;
}): BuiltReportNotification {
  return {
    userId,
    type: 'daily_report',
    title: '日报已生成',
    body: `查看 ${date} 的减脂复盘，今日评分 ${score}/100。`,
    payload: { reportId, date, score },
    status: 'sent',
    scheduledAt: sentAt,
    sentAt,
  };
}

export function buildWeeklyReportNotification({
  userId,
  reportId,
  weekIndex,
  startDate,
  endDate,
  score,
  sentAt = new Date(),
}: {
  userId: string;
  reportId: string;
  weekIndex: number;
  startDate: string;
  endDate: string;
  score: number;
  sentAt?: Date;
}): BuiltReportNotification {
  return {
    userId,
    type: 'weekly_report',
    title: '周报已生成',
    body: `查看第 ${weekIndex} 周复盘，周期 ${startDate} 至 ${endDate}，评分 ${score}/100。`,
    payload: { reportId, weekIndex, startDate, endDate, score },
    status: 'sent',
    scheduledAt: sentAt,
    sentAt,
  };
}

export function getReportNotificationKey(notification: Pick<BuiltReportNotification, 'type' | 'payload'>): string {
  const reportId = notification.payload?.reportId;
  return `${notification.type}:${reportId || ''}`;
}
