import { getPrisma } from '@/lib/prisma';

export function isToolCallSafe(toolName: string, args: Record<string, unknown>) {
  if (toolName === 'update_weight_goal') {
    const goalWeight = typeof args.goalWeight === 'number' && Number.isFinite(args.goalWeight) ? args.goalWeight : null;
    const userId = typeof args.userId === 'string' ? args.userId : null;
    if (!userId || goalWeight === null || goalWeight <= 0) return { ok: false, error: '目标体重参数不合法' };
    return { ok: true as const, parsed: { ...args, userId, goalWeight } };
  }

  if (toolName === 'update_calorie_target') {
    const userId = typeof args.userId === 'string' ? args.userId : null;
    const startDate = typeof args.startDate === 'string' ? args.startDate : null;
    const days = typeof args.days === 'number' && Number.isFinite(args.days) ? args.days : null;
    const calorieDelta = typeof args.calorieDelta === 'number' && Number.isFinite(args.calorieDelta) ? args.calorieDelta : null;
    if (!userId || !startDate || days === null || calorieDelta === null) return { ok: false, error: '热量调整参数不合法' };
    return { ok: true as const, parsed: { ...args, userId, startDate, days, calorieDelta } };
  }

  return { ok: true as const, parsed: args };
}

export function buildIdempotencyKey(toolName: string, args: Record<string, unknown>) {
  const payload = JSON.stringify({ toolName, args });
  return payload;
}

export async function ensureUserExists(userId: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  return user;
}
