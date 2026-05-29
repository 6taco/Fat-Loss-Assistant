import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDailyReportNotification,
  buildWeeklyReportNotification,
  getReportNotificationKey,
} from './report-notifications.js';

const sentAt = new Date('2026-05-29T16:00:00.000Z');

test('builds a sent daily report notification with a stable key', () => {
  const notification = buildDailyReportNotification({
    userId: 'user-1',
    reportId: 'daily-1',
    date: '2026-05-28',
    score: 82,
    sentAt,
  });

  assert.equal(notification.type, 'daily_report');
  assert.equal(notification.status, 'sent');
  assert.equal(notification.sentAt, sentAt);
  assert.equal(notification.scheduledAt, sentAt);
  assert.deepEqual(notification.payload, {
    reportId: 'daily-1',
    date: '2026-05-28',
    score: 82,
  });
  assert.equal(getReportNotificationKey(notification), 'daily_report:daily-1');
});

test('builds a sent weekly report notification with a stable key', () => {
  const notification = buildWeeklyReportNotification({
    userId: 'user-1',
    reportId: 'weekly-1',
    weekIndex: 4,
    startDate: '2026-05-01',
    endDate: '2026-05-07',
    score: 76,
    sentAt,
  });

  assert.equal(notification.type, 'weekly_report');
  assert.equal(notification.status, 'sent');
  assert.deepEqual(notification.payload, {
    reportId: 'weekly-1',
    weekIndex: 4,
    startDate: '2026-05-01',
    endDate: '2026-05-07',
    score: 76,
  });
  assert.equal(getReportNotificationKey(notification), 'weekly_report:weekly-1');
});
