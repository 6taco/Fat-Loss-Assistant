import { getPrisma } from '@/lib/prisma';
import { dateToISODate, toDate } from '@/lib/server-mappers';
import { generateMealPlans, generateShoppingList, generateTrainingPlan } from '@/lib/coach';

export async function executeToolProposal(proposalId: string, userId: string) {
  const prisma = getPrisma();
  const proposal = await prisma.actionProposal.findFirst({ where: { id: proposalId, userId } });
  if (!proposal) throw new Error('未找到这条提案。');
  if (proposal.status !== 'pending') return proposal;

  const payload = isRecord(proposal.payload) ? proposal.payload : {};
  const startDate = asString(payload.startDate) || dateToISODate(new Date());
  const days = asNumber(payload.days) || 3;

  switch (proposal.toolName || proposal.type) {
    case 'generate_meal_plan':
      await generateMealPlans(userId, startDate, days);
      break;
    case 'generate_training_plan':
      await generateTrainingPlan(userId, startDate, days);
      break;
    case 'create_shopping_list':
      await generateShoppingList(userId, startDate, days);
      break;
    case 'update_weight_goal':
      await prisma.user.update({
        where: { id: userId },
        data: { goalWeight: asNumber(payload.goalWeight) ?? 0 },
      });
      break;
    case 'update_calorie_target': {
      const plans = await prisma.dayPlan.findMany({
        where: { userId, date: { gte: toDate(startDate), lte: toDate(addDays(startDate, days - 1)) } },
      });
      const delta = asNumber(payload.calorieDelta) ?? 0;
      await prisma.$transaction(plans.map(plan => prisma.dayPlan.update({
        where: { id: plan.id },
        data: {
          calories: Math.max(1200, plan.calories + delta),
          fat: Math.max(25, Math.round((Math.max(1200, plan.calories + delta) - plan.carb * 4 - plan.protein * 4) / 9)),
        },
      })));
      break;
    }
    case 'reorder_carb_cycle': {
      const plans = await prisma.dayPlan.findMany({
        where: { userId, date: { gte: toDate(startDate), lte: toDate(addDays(startDate, days - 1)) } },
        orderBy: { date: 'asc' },
      });
      const highIds = new Set(plans.slice(0, 2).map(plan => plan.id));
      const lowIds = new Set(plans.slice(-2).map(plan => plan.id));
      await prisma.$transaction(plans.map(plan => prisma.dayPlan.update({
        where: { id: plan.id },
        data: { carbType: highIds.has(plan.id) ? 'high' : lowIds.has(plan.id) ? 'low' : 'mid' },
      })));
      break;
    }
  }

  const updated = await prisma.actionProposal.update({
    where: { id: proposal.id },
    data: {
      status: 'accepted',
      decidedAt: new Date(),
      approvedAt: new Date(),
      approvedByUserId: userId,
      executionState: 'completed',
    },
  });

  await logExecution(prisma, proposal.id, userId, proposal.toolName || proposal.type, 'completed', { payload: proposal.payload });
  await createSnapshot(prisma, proposal.id, userId, proposal.toolName || proposal.type, proposal.payload);
  return updated;
}

export async function dismissToolProposal(proposalId: string, userId: string) {
  const prisma = getPrisma();
  const proposal = await prisma.actionProposal.findFirst({ where: { id: proposalId, userId } });
  if (!proposal) throw new Error('未找到这条提案。');

  const updated = await prisma.actionProposal.update({
    where: { id: proposal.id },
    data: { status: 'dismissed', decidedAt: new Date(), executionState: 'failed' },
  });
  await logExecution(prisma, proposal.id, userId, proposal.toolName || proposal.type, 'dismissed', {});
  return updated;
}

async function logExecution(prisma: ReturnType<typeof getPrisma>, proposalId: string, userId: string, toolName: string, status: string, resultJson: unknown) {
  await prisma.toolExecutionLog.create({
    data: {
      userId,
      toolName,
      proposalId,
      approvedByUserId: userId,
      status,
      resultJson: resultJson as never,
    },
  }).catch(() => null);
}

async function createSnapshot(prisma: ReturnType<typeof getPrisma>, proposalId: string, userId: string, toolName: string, beforeJson: unknown) {
  await prisma.toolExecutionSnapshot.create({
    data: {
      userId,
      toolName,
      proposalId,
      beforeJson: beforeJson as never,
      afterJson: { status: 'completed' } as never,
    },
  }).catch(() => null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function addDays(date: string, days: number) {
  const next = toDate(date);
  next.setDate(next.getDate() + days);
  return dateToISODate(next);
}
