import { getShanghaiDate } from '@/lib/daily-report';
import { getPrisma } from '@/lib/prisma';
import {
  dailyReportToResponse,
  dateToISODate,
  dayPlanToResponse,
  mealLogToResponse,
  toDate,
  userToResponse,
  weightToResponse,
  weeklyReportToResponse,
} from '@/lib/server-mappers';
import { generateWeightPrediction } from '@/lib/weight-prediction';
import type { AgentContext, AgentRunType } from '@/lib/agents/types';

export async function buildAgentContext(userId: string, options: { date?: string; runType?: AgentRunType } = {}): Promise<AgentContext> {
  const prisma = getPrisma();
  const date = options.date || getShanghaiDate();
  const lookbackDays = options.runType === 'weekly' ? 21 : 14;
  const forwardDays = options.runType === 'weekly' ? 14 : 7;
  const from = addDays(date, -lookbackDays);
  const to = addDays(date, forwardDays);

  const [user, plans, meals, weights, dailyReport, weeklyReport, memories, coachMemories] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.dayPlan.findMany({ where: { userId, date: { gte: toDate(from), lte: toDate(to) } }, orderBy: { date: 'asc' } }),
    prisma.mealLog.findMany({ where: { userId, date: { gte: toDate(from), lte: toDate(date) } }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    prisma.weightEntry.findMany({ where: { userId, date: { gte: toDate(from), lte: toDate(date) } }, orderBy: { date: 'asc' } }),
    prisma.dailyReport.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.weeklyReport.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.agentMemory.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 12 }).catch(() => []),
    prisma.coachMemory.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 8 }),
  ]);

  if (!user) throw new Error('User not found');

  let predictions;
  try {
    predictions = await generateWeightPrediction(userId, 30);
  } catch {
    predictions = undefined;
  }

  return {
    user: userToResponse(user),
    date,
    plans: plans.map(dayPlanToResponse),
    meals: meals.map(mealLogToResponse),
    weights: weights.map(weightToResponse),
    reports: {
      daily: dailyReport ? dailyReportToResponse(dailyReport) : undefined,
      weekly: weeklyReport ? weeklyReportToResponse(weeklyReport) : undefined,
    },
    predictions,
    memories: memories.map(memory => ({
      id: memory.id,
      userId: memory.userId,
      agent: normalizeAgent(memory.agent),
      type: normalizeMemoryType(memory.type),
      title: memory.title,
      content: memory.content,
      confidence: memory.confidence,
      source: memory.source,
    })),
    coachMemories,
    ragEvidence: [],
  };
}

function addDays(date: string, days: number) {
  const next = toDate(date);
  next.setDate(next.getDate() + days);
  return dateToISODate(next);
}

function normalizeAgent(value: string) {
  if (value === 'nutrition' || value === 'training' || value === 'recovery' || value === 'strategy' || value === 'coach') return value;
  return 'coach';
}

function normalizeMemoryType(value: string) {
  if (
    value === 'preference'
    || value === 'effective_strategy'
    || value === 'risk_pattern'
    || value === 'rejected_advice'
    || value === 'milestone'
    || value === 'nutrition_pattern'
    || value === 'training_pattern'
    || value === 'recovery_pattern'
  ) return value;
  return 'preference';
}
