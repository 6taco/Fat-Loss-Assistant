export function buildDailyReportNotification({ userId, reportId, date, score, sentAt = new Date() }) {
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
}) {
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

export function getReportNotificationKey(notification) {
  const reportId = notification.payload?.reportId;
  return `${notification.type}:${reportId || ''}`;
}
