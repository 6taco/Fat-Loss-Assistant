import { Prisma } from '@prisma/client';
import { DailyReportNotReadyError, generateDailyReport, getShanghaiDate } from '@/lib/daily-report';
import { getPrisma } from '@/lib/prisma';
import { dateToISODate, dayPlanToResponse, toDate } from '@/lib/server-mappers';
import { generateWeightPrediction } from '@/lib/weight-prediction';
import { WeeklyReportNotReadyError, generateWeeklyReport, getPreviousClosedWeekIndex } from '@/lib/weekly-report';
import { runAgentWorkflow } from '@/lib/agents/orchestrator';
import {
  calculateMealCalories,
  type ActionProposal,
  type CarbType,
  type CoachFeed,
  type CoachInsight,
  type CoachMemory,
  type MealType,
  type MuscleGroup,
  type NotificationEvent,
} from '@/lib/mock-data';
import { executeToolProposal, dismissToolProposal } from '@/lib/mcp/executor';

const MAX_CALORIE_DELTA = 150;
const MIN_CALORIES = 1200;
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

interface CoachRunOptions {
  userId: string;
  date?: string;
  force?: boolean;
}

interface CoachRunResult {
  feed: CoachFeed;
  dailyReportId?: string;
  weeklyReportId?: string;
}

export async function runDailyCoach(options: CoachRunOptions): Promise<CoachRunResult> {
  const date = options.date || getShanghaiDate();
  let dailyReportId: string | undefined;

  try {
    const report = await generateDailyReport(options.userId, date, Boolean(options.force));
    dailyReportId = report.id;
    await upsertInsight({
      userId: options.userId,
      date,
      type: 'daily_review',
      severity: report.score >= 75 ? 'info' : 'action',
      title: `每日复盘：${report.score}/100`,
      summary: report.summary,
      evidence: { reportId: report.id, suggestions: report.suggestions },
    });
  } catch (error) {
    if (!(error instanceof DailyReportNotReadyError)) throw error;
    await upsertInsight({
      userId: options.userId,
      date,
      type: 'adherence',
      severity: 'warning',
      title: '今天还缺一条有效记录',
      summary: error.message,
      evidence: { reason: 'daily_report_not_ready' },
    });
  }

  try {
    await runAgentWorkflow({ userId: options.userId, runType: 'daily', date, force: options.force });
  } catch {
    await createDailySignals(options.userId, date);
  }
  await queueDailyNotification(options.userId, date);
  return { feed: await getCoachFeed(options.userId), dailyReportId };
}

export async function runWeeklyCoach(options: CoachRunOptions): Promise<CoachRunResult> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: options.userId } });
  if (!user) throw new Error('User not found');

  const weekIndex = getPreviousClosedWeekIndex(dateToISODate(user.startDate)) || 1;
  let weeklyReportId: string | undefined;

  try {
    const report = await generateWeeklyReport(options.userId, weekIndex, Boolean(options.force));
    weeklyReportId = report.id;
    await upsertInsight({
      userId: options.userId,
      date: report.endDate,
      type: 'weekly_review',
      severity: report.score >= 75 ? 'info' : 'action',
      title: report.headline || `每周报告：${report.score}/100`,
      summary: report.summary,
      evidence: { reportId: report.id, metrics: report.metrics, risks: report.risks },
    });
  } catch (error) {
    if (!(error instanceof WeeklyReportNotReadyError)) throw error;
  }

  try {
    await runAgentWorkflow({ userId: options.userId, runType: 'weekly', date: options.date, force: options.force });
  } catch {
    await createWeeklySignals(options.userId);
  }
  await queueWeeklyNotification(options.userId);
  return { feed: await getCoachFeed(options.userId), weeklyReportId };
}

export async function getCoachFeed(userId: string): Promise<CoachFeed> {
  const prisma = getPrisma();
  const [insights, proposals, notifications, memories] = await Promise.all([
    prisma.coachInsight.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.actionProposal.findMany({ where: { userId, status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.notificationEvent.findMany({ where: { userId }, orderBy: { scheduledAt: 'desc' }, take: 10 }),
    prisma.coachMemory.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 8 }),
  ]);

  return {
    insights: insights.map(insightToDto),
    proposals: proposals.map(proposalToDto),
    notifications: notifications.map(notificationToDto),
    memories: memories.map(memoryToDto),
  };
}

export async function acceptProposal(proposalId: string, userId: string) {
  return executeToolProposal(proposalId, userId);
}

export async function dismissProposal(proposalId: string, userId: string) {
  return dismissToolProposal(proposalId, userId);
}

export async function generateMealPlans(userId: string, startDate: string, days = 3) {
  const prisma = getPrisma();
  const plans = await prisma.dayPlan.findMany({
    where: { userId, date: { gte: toDate(startDate), lte: toDate(addDays(startDate, days - 1)) } },
    orderBy: { date: 'asc' },
  });
  if (!plans.length) throw new Error('当前日期范围内没有可用于生成餐单的每日计划。');

  await prisma.$transaction(plans.map(plan => {
    const meals = buildMealsForPlan(dayPlanToResponse(plan));
    return prisma.mealPlan.upsert({
      where: { userId_date: { userId, date: plan.date } },
      create: {
        userId,
        date: plan.date,
        meals: meals as unknown as Prisma.InputJsonValue,
        macros: { calories: plan.calories, carb: plan.carb, protein: plan.protein, fat: plan.fat } as unknown as Prisma.InputJsonValue,
        source: 'coach_rules_v1',
      },
      update: {
        meals: meals as unknown as Prisma.InputJsonValue,
        macros: { calories: plan.calories, carb: plan.carb, protein: plan.protein, fat: plan.fat } as unknown as Prisma.InputJsonValue,
        source: 'coach_rules_v1',
      },
    });
  }));

  return prisma.mealPlan.findMany({
    where: { userId, date: { gte: toDate(startDate), lte: toDate(addDays(startDate, days - 1)) } },
    orderBy: { date: 'asc' },
  });
}

export async function generateTrainingPlan(userId: string, startDate: string, days = 7) {
  const prisma = getPrisma();
  const dayPlans = await prisma.dayPlan.findMany({
    where: { userId, date: { gte: toDate(startDate), lte: toDate(addDays(startDate, days - 1)) } },
    orderBy: { date: 'asc' },
  });
  if (!dayPlans.length) throw new Error('当前日期范围内没有可用于生成训练安排的每日计划。');

  const trainingDays = dayPlans.map(plan => buildTrainingDay(dayPlanToResponse(plan)));
  return prisma.trainingPlan.create({
    data: {
      userId,
      startDate: toDate(startDate),
      endDate: toDate(addDays(startDate, days - 1)),
      days: trainingDays as unknown as Prisma.InputJsonValue,
      source: 'coach_rules_v1',
    },
  });
}

export async function generateShoppingList(userId: string, startDate: string, days = 3) {
  const prisma = getPrisma();
  let mealPlans = await prisma.mealPlan.findMany({
    where: { userId, date: { gte: toDate(startDate), lte: toDate(addDays(startDate, days - 1)) } },
    orderBy: { date: 'asc' },
  });
  if (!mealPlans.length) mealPlans = await generateMealPlans(userId, startDate, days);

  const items = aggregateShoppingItems(mealPlans.map(plan => plan.meals));
  return prisma.shoppingList.create({
    data: {
      userId,
      startDate: toDate(startDate),
      endDate: toDate(addDays(startDate, days - 1)),
      items: items as unknown as Prisma.InputJsonValue,
      source: 'coach_rules_v1',
    },
  });
}

async function createDailySignals(userId: string, date: string) {
  const prisma = getPrisma();
  const today = toDate(date);
  const [plan, meals, weights] = await Promise.all([
    prisma.dayPlan.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.mealLog.findMany({ where: { userId, date: today } }),
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 14 }),
  ]);

  if (!plan) return;

  const calories = meals.reduce((sum, meal) => sum + (meal.calories ?? calculateMealCalories(meal)), 0);
  const protein = meals.reduce((sum, meal) => sum + meal.protein, 0);

  if (meals.length === 0) {
    await upsertInsight({
      userId,
      date,
      type: 'nutrition',
      severity: 'warning',
      title: '今天还没有饮食记录',
      summary: '先记一餐就够了，这样教练才能更准确地给出明天建议。',
      evidence: { mealCount: 0 },
    });
  } else if (protein < plan.protein * 0.8) {
    await upsertProposal(
      userId,
      'generate_meal_plan',
      '生成高蛋白优先餐单',
      '今天蛋白质低于目标，建议生成 3 天餐单来提高达标率。',
      { startDate: date, days: 3 },
      { protein, target: plan.protein },
      'low',
    );
  }

  if (calories > plan.calories * 1.2) {
    await upsertInsight({
      userId,
      date,
      type: 'adherence',
      severity: 'action',
      title: '今天热量偏高',
      summary: '明天正常拉回节奏，不需要极端补偿。',
      evidence: { calories, target: plan.calories },
    });
  }

  if (weights.length >= 7) await createPlateauSignals(userId);
}

async function createWeeklySignals(userId: string) {
  await createPlateauSignals(userId);
  const prisma = getPrisma();
  const latestPlan = await prisma.dayPlan.findFirst({ where: { userId }, orderBy: { date: 'asc' } });
  if (!latestPlan) return;

  await upsertProposal(
    userId,
    'generate_training_plan',
    '生成下一阶段训练安排',
    '生成 7 天训练计划，让训练强度、恢复日和碳循环更匹配。',
    { startDate: dateToISODate(latestPlan.date), days: 7 },
    { trigger: 'weekly_review' },
    'low',
  );

  await upsertProposal(
    userId,
    'generate_shopping_list',
    '生成采购清单',
    '根据未来 3 天饮食目标汇总食材，减少临时决策成本。',
    { startDate: dateToISODate(latestPlan.date), days: 3 },
    { trigger: 'weekly_review' },
    'low',
  );
}

async function createPlateauSignals(userId: string) {
  const prisma = getPrisma();
  const prediction = await generateWeightPrediction(userId, 30);
  if (prediction.plateau.status !== 'possible') return;

  await upsertInsight({
    userId,
    date: getShanghaiDate(),
    type: 'plateau',
    severity: 'action',
    title: '检测到可能的平台期',
    summary: prediction.plateau.reason,
    evidence: { plateau: prediction.plateau, calorieDeficit: prediction.calorieDeficit },
  });

  const recentPlans = await prisma.dayPlan.findMany({
    where: { userId, date: { gte: toDate(getShanghaiDate()), lte: toDate(addDays(getShanghaiDate(), 6)) } },
    orderBy: { date: 'asc' },
  });
  if (!recentPlans.length) return;

  const averageCalories = Math.round(recentPlans.reduce((sum, plan) => sum + plan.calories, 0) / recentPlans.length);
  await upsertProposal(
    userId,
    'update_calorie_target',
    '小幅调整热量目标',
    '未来 7 天小幅下调热量，保持蛋白稳定，避免过度节食。',
    {
      startDate: getShanghaiDate(),
      days: 7,
      calorieDelta: -Math.min(MAX_CALORIE_DELTA, 120),
      minCalories: MIN_CALORIES,
    },
    { plateau: prediction.plateau, averageCalories },
    'medium',
  );

  await upsertProposal(
    userId,
    'reorder_carb_cycle',
    '重新分配碳循环',
    '把高碳日优先匹配到更高强度训练日，休息日维持低碳。',
    {
      startDate: getShanghaiDate(),
      days: 7,
    },
    { plateau: prediction.plateau },
    'medium',
  );
}

async function upsertInsight(input: {
  userId: string;
  date: string;
  type: string;
  severity: string;
  title: string;
  summary: string;
  evidence: unknown;
}) {
  const prisma = getPrisma();
  const existing = await prisma.coachInsight.findFirst({
    where: { userId: input.userId, date: toDate(input.date), type: input.type, title: input.title },
  });
  if (existing) {
    return prisma.coachInsight.update({
      where: { id: existing.id },
      data: {
        severity: input.severity,
        summary: input.summary,
        evidence: input.evidence as unknown as Prisma.InputJsonValue,
      },
    });
  }
  return prisma.coachInsight.create({
    data: {
      userId: input.userId,
      date: toDate(input.date),
      type: input.type,
      severity: input.severity,
      title: input.title,
      summary: input.summary,
      evidence: input.evidence as unknown as Prisma.InputJsonValue,
    },
  });
}

async function upsertProposal(
  userId: string,
  type: 'adjust_calorie_target' | 'adjust_carb_cycle' | 'generate_meal_plan' | 'generate_training_plan' | 'generate_shopping_list' | 'update_weight_goal' | 'update_calorie_target' | 'reorder_carb_cycle' | 'create_shopping_list',
  title: string,
  summary: string,
  payload: unknown,
  reason: unknown,
  risk: 'low' | 'medium',
) {
  const prisma = getPrisma();
  const existing = await prisma.actionProposal.findFirst({
    where: { userId, type, status: 'pending', title },
  });
  const safety = {
    requiresUserConfirmation: true,
    risk,
    maxDailyCalorieChange: MAX_CALORIE_DELTA,
    medicalAdvice: false,
  };
  if (existing) {
    return prisma.actionProposal.update({
      where: { id: existing.id },
      data: {
        summary,
        payload: payload as unknown as Prisma.InputJsonValue,
        reason: reason as unknown as Prisma.InputJsonValue,
        safety: safety as unknown as Prisma.InputJsonValue,
      },
    });
  }
  return prisma.actionProposal.create({
    data: {
      userId,
      type,
      title,
      summary,
      payload: payload as unknown as Prisma.InputJsonValue,
      reason: reason as unknown as Prisma.InputJsonValue,
      safety: safety as unknown as Prisma.InputJsonValue,
    },
  });
}

async function queueDailyNotification(userId: string, date: string) {
  const prisma = getPrisma();
  const scheduledAt = new Date(`${date}T21:30:00+08:00`);
  const existing = await prisma.notificationEvent.findFirst({ where: { userId, type: 'daily_review', scheduledAt } });
  if (existing) return;

  await prisma.notificationEvent.create({
    data: {
      userId,
      type: 'daily_review',
      title: '每日教练复盘已生成',
      body: '教练已经整理出明天最值得执行的一步。',
      scheduledAt,
      payload: { date } as unknown as Prisma.InputJsonValue,
    },
  });
}

async function queueWeeklyNotification(userId: string) {
  const prisma = getPrisma();
  const scheduledAt = new Date();
  await prisma.notificationEvent.create({
    data: {
      userId,
      type: 'weekly_review',
      title: '每周教练报告已生成',
      body: '查看本周趋势、平台期状态和下周策略。',
      scheduledAt,
      payload: { generatedAt: scheduledAt.toISOString() } as unknown as Prisma.InputJsonValue,
    },
  });
}

function buildMealsForPlan(plan: { carbType: CarbType; calories: number; carb: number; protein: number; fat: number }) {
  const distribution: Record<MealType, number> = { breakfast: 0.28, lunch: 0.34, dinner: 0.3, snack: 0.08 };
  return (Object.keys(distribution) as MealType[]).map(mealType => ({
    mealType,
    label: MEAL_LABELS[mealType],
    calories: Math.round(plan.calories * distribution[mealType]),
    carb: Math.round(plan.carb * distribution[mealType]),
    protein: Math.round(plan.protein * distribution[mealType]),
    fat: Math.round(plan.fat * distribution[mealType]),
    foods: pickFoods(plan.carbType, mealType),
  }));
}

function pickFoods(carbType: CarbType, mealType: MealType) {
  const protein = mealType === 'breakfast' ? '鸡蛋或无糖酸奶' : '鸡胸、鱼、豆腐或瘦牛肉';
  const carb = carbType === 'high' ? '米饭、燕麦、土豆或面条' : carbType === 'mid' ? '米饭、红薯或全麦面包' : '绿叶蔬菜和少量水果';
  const fat = carbType === 'low' ? '牛油果、橄榄油或坚果' : '少量橄榄油或坚果';
  return [protein, carb, fat];
}

function buildTrainingDay(plan: { date: string; carbType: CarbType; muscleGroup?: MuscleGroup; trainingLabel?: string }) {
  const isRest = !plan.muscleGroup || plan.muscleGroup === 'rest';
  return {
    date: plan.date,
    muscleGroup: plan.muscleGroup || 'rest',
    label: plan.trainingLabel || (isRest ? '恢复日' : '力量训练'),
    intensity: plan.carbType === 'high' ? '高强度' : plan.carbType === 'mid' ? '中等强度' : '恢复',
    blocks: isRest
      ? ['30-45 分钟轻松步行', '10 分钟灵活性放松']
      : ['8 分钟热身', '3-5 个复合动作', '5 分钟放松'],
  };
}

function aggregateShoppingItems(mealPlans: unknown[]) {
  const base = new Map<string, { name: string; category: string; count: number }>();
  for (const meals of mealPlans) {
    if (!Array.isArray(meals)) continue;
    for (const meal of meals) {
      const foods = meal && typeof meal === 'object' && Array.isArray((meal as { foods?: unknown }).foods) ? (meal as { foods: string[] }).foods : [];
      for (const food of foods) {
        const key = food.toLowerCase();
        const category = key.includes('米饭') || key.includes('燕麦') || key.includes('土豆') || key.includes('红薯') || key.includes('面条') || key.includes('面包')
          ? '碳水'
          : key.includes('油') || key.includes('坚果') || key.includes('牛油果')
            ? '脂肪'
            : '蛋白质';
        base.set(key, { name: food, category, count: (base.get(key)?.count || 0) + 1 });
      }
    }
  }
  return [...base.values()].map(item => ({ ...item, amountText: `${item.count} 份计划用量` }));
}

function insightToDto(insight: {
  id: string;
  userId: string;
  date: Date;
  type: string;
  severity: string;
  title: string;
  summary: string;
  evidence: unknown;
  status: string;
  createdAt: Date;
}): CoachInsight {
  return {
    id: insight.id,
    userId: insight.userId,
    date: dateToISODate(insight.date),
    type: normalizeInsightType(insight.type),
    severity: normalizeSeverity(insight.severity),
    title: insight.title,
    summary: insight.summary,
    evidence: insight.evidence,
    status: insight.status === 'read' || insight.status === 'archived' ? insight.status : 'new',
    createdAt: insight.createdAt.toISOString(),
  };
}

function proposalToDto(proposal: {
  id: string;
  userId: string;
  type: string;
  status: string;
  title: string;
  summary: string;
  payload: unknown;
  reason: unknown;
  safety: unknown;
  toolName: string | null;
  executionState: string;
  diffPreview: unknown;
  approvedAt: Date | null;
  approvedByUserId: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}): ActionProposal {
  return {
    id: proposal.id,
    userId: proposal.userId,
    type: normalizeProposalType(proposal.type),
    status: normalizeProposalStatus(proposal.status),
    title: proposal.title,
    summary: proposal.summary,
    payload: proposal.payload,
    reason: proposal.reason,
    safety: proposal.safety,
    toolName: proposal.toolName ?? undefined,
    executionState: normalizeExecutionState(proposal.executionState),
    diffPreview: proposal.diffPreview ?? undefined,
    approvedAt: proposal.approvedAt?.toISOString(),
    approvedByUserId: proposal.approvedByUserId ?? undefined,
    createdAt: proposal.createdAt.toISOString(),
    decidedAt: proposal.decidedAt?.toISOString(),
  };
}

function notificationToDto(notification: {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
}): NotificationEvent {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    payload: notification.payload ?? undefined,
    status: notification.status === 'sent' || notification.status === 'read' || notification.status === 'cancelled' ? notification.status : 'queued',
    scheduledAt: notification.scheduledAt.toISOString(),
    sentAt: notification.sentAt?.toISOString(),
    createdAt: notification.createdAt.toISOString(),
  };
}

function memoryToDto(memory: {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: unknown;
  confidence: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}): CoachMemory {
  return {
    id: memory.id,
    userId: memory.userId,
    type: normalizeMemoryType(memory.type),
    title: memory.title,
    content: memory.content,
    confidence: memory.confidence,
    source: memory.source,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}

function addDays(date: string, days: number) {
  const next = toDate(date);
  next.setDate(next.getDate() + days);
  return dateToISODate(next);
}

function normalizeInsightType(value: string): CoachInsight['type'] {
  if (value === 'daily_review' || value === 'weekly_review' || value === 'plateau' || value === 'adherence' || value === 'nutrition' || value === 'training' || value === 'motivation') return value;
  return 'motivation';
}

function normalizeSeverity(value: string): CoachInsight['severity'] {
  if (value === 'warning' || value === 'action') return value;
  return 'info';
}

function normalizeProposalType(value: string): ActionProposal['type'] {
  if (
    value === 'adjust_calorie_target'
    || value === 'adjust_carb_cycle'
    || value === 'generate_meal_plan'
    || value === 'generate_training_plan'
    || value === 'generate_shopping_list'
    || value === 'update_weight_goal'
    || value === 'update_calorie_target'
    || value === 'reorder_carb_cycle'
    || value === 'create_shopping_list'
  ) return value;
  return 'generate_meal_plan';
}

function normalizeProposalStatus(value: string): ActionProposal['status'] {
  if (value === 'accepted' || value === 'edited' || value === 'dismissed' || value === 'expired') return value;
  return 'pending';
}

function normalizeExecutionState(value: string): ActionProposal['executionState'] {
  if (value === 'draft' || value === 'pending_confirmation' || value === 'executing' || value === 'completed' || value === 'failed' || value === 'partially_failed') return value;
  return 'pending_confirmation';
}

function normalizeMemoryType(value: string): CoachMemory['type'] {
  if (value === 'preference' || value === 'effective_strategy' || value === 'risk_pattern' || value === 'milestone' || value === 'rejected_advice') return value;
  return 'preference';
}
