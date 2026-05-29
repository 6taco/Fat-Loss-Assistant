import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import type { BuiltReportNotification } from '@/lib/report-notifications';

export async function upsertSentReportNotification(notification: BuiltReportNotification) {
  const prisma = getPrisma();
  const existing = await prisma.notificationEvent.findMany({
    where: { userId: notification.userId, type: notification.type },
    orderBy: { createdAt: 'desc' },
    take: 30,
  }).then(items => items.find(item => notificationPayloadReportId(item.payload) === notification.payload.reportId));

  const data = {
    title: notification.title,
    body: notification.body,
    payload: notification.payload as Prisma.InputJsonValue,
    status: notification.status,
    scheduledAt: notification.scheduledAt,
    sentAt: notification.sentAt,
  };

  if (existing) {
    await prisma.notificationEvent.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.notificationEvent.create({
    data: {
      userId: notification.userId,
      type: notification.type,
      ...data,
    },
  });
}

function notificationPayloadReportId(payload: unknown) {
  return payload && typeof payload === 'object' && 'reportId' in payload
    ? String((payload as { reportId: unknown }).reportId)
    : '';
}
