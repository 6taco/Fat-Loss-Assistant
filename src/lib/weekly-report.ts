import { Prisma } from '@prisma/client';
import { askDeepSeek } from '@/lib/deepseek';
import { getPrisma } from '@/lib/prisma';
import { dateToISODate, toDate } from '@/lib/server-mappers';
import {
  calculateMealCalories,
  type WeeklyReport,
  type WeeklyReportMetrics,
  type WeeklyReportRisk,
} from '@/lib/mock-data';

type WeeklyMealRecord = {
  date: Date | string;
  calories: number | null;
  carb: number;
  protein: number;
  fat: number;
};

export class WeeklyReportNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeeklyReportNotReadyError';
  }
}

interface WeeklyReportContent {
  headline: string;
  summary: string;
  suggestions: string[];
}

interface WeeklyMetricsContext {
  userId: string;
  userName: string;
  goalWeight: number;
  startDate: string;
  weekIndex: number;
  weekStartDate: string;
  weekEndDate: string;
  metrics: WeeklyReportMetrics;
  risks: WeeklyReportRisk[];
}

export function getWeekRangeByIndex(userStartDate: string, weekIndex: number) {
  const start = toDate(userStartDate);
  start.setDate(start.getDate() + (weekIndex - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    weekIndex,
    startDate: dateToISODate(start),
    endDate: dateToISODate(end),
  };
}

export function getCurrentUserWeekIndex(userStartDate: string, now = new Date()): number {
  const start = toDate(userStartDate).getTime();
  const diff = Math.floor((toDate(dateToISODate(now)).getTime() - start) / 86400000);
  return Math.max(1, Math.floor(diff / 7) + 1);
}

export function getPreviousClosedWeekIndex(userStartDate: string, now = new Date()): number | null {
  const current = getCurrentUserWeekIndex(userStartDate, now);
  return current > 1 ? current - 1 : null;
}

export async function collectWeeklyReportMetrics(userId: string, weekIndex?: number): Promise<WeeklyMetricsContext> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const index = weekIndex || getCurrentUserWeekIndex(dateToISODate(user.startDate));
  const range = getWeekRangeByIndex(dateToISODate(user.startDate), index);
  const start = toDate(range.startDate);
  const end = toDate(range.endDate);

  const [plans, meals, weights] = await Promise.all([
    prisma.dayPlan.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),
    prisma.mealLog.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    prisma.weightEntry.findMany({ where: { userId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),
  ]);

  if (!plans.length && !meals.length && !weights.length) {
    throw new WeeklyReportNotReadyError('这一周还没有可复盘的数据。先记录饮食、体重或完成几次打卡后，我再帮你生成周报。');
  }

  const mealsByDate = groupMealsByDate(meals);
  const planByDate = new Map(plans.map(plan => [dateToISODate(plan.date), plan]));
  const mealDates = [...mealsByDate.keys()];
  const caloriesByDate = new Map<string, number>();
  const proteinByDate = new Map<string, number>();
  const risks: WeeklyReportRisk[] = [];

  for (const date of mealDates) {
    const dayMeals = mealsByDate.get(date) || [];
    const calories = dayMeals.reduce((sum, meal) => sum + (meal.calories ?? calculateMealCalories(meal)), 0);
    const protein = dayMeals.reduce((sum, meal) => sum + meal.protein, 0);
    caloriesByDate.set(date, calories);
    proteinByDate.set(date, protein);

    const plan = planByDate.get(date);
    if (plan && calories > plan.calories * 1.3) {
      risks.push({
        date,
        type: 'binge',
        message: `当天热量约 ${Math.round(calories)} kcal，超过目标 30%。`,
      });
    }
  }

  const proteinHitDays = [...proteinByDate.entries()].filter(([date, protein]) => {
    const target = planByDate.get(date)?.protein;
    return target ? protein / target >= 0.9 : false;
  }).length;
  const completedDays = plans.filter(plan => plan.completed).length;
  const longestStreak = getLongestStreak(plans.map(plan => ({ date: dateToISODate(plan.date), completed: plan.completed })));
  const startWeight = weights[0]?.weight;
  const endWeight = weights[weights.length - 1]?.weight;
  const weightChange = startWeight !== undefined && endWeight !== undefined ? endWeight - startWeight : undefined;
  const totalCalories = [...caloriesByDate.values()].reduce((sum, value) => sum + value, 0);
  const totalProtein = [...proteinByDate.values()].reduce((sum, value) => sum + value, 0);
  const predictionDays = getPredictionDays(weightChange, user.goalWeight, endWeight);
  const dataCompleteness = Math.round(((plans.length ? 1 : 0) + (mealDates.length / 7) + (weights.length ? 1 : 0)) / 3 * 100);

  return {
    userId,
    userName: user.name,
    goalWeight: user.goalWeight,
    startDate: dateToISODate(user.startDate),
    weekIndex: index,
    weekStartDate: range.startDate,
    weekEndDate: range.endDate,
    metrics: {
      startWeight,
      endWeight,
      weightChange,
      averageCalories: mealDates.length ? Math.round(totalCalories / mealDates.length) : 0,
      averageProtein: mealDates.length ? Math.round(totalProtein / mealDates.length) : 0,
      proteinHitRate: mealDates.length ? Math.round(proteinHitDays / mealDates.length * 100) : 0,
      completedDays,
      longestStreak,
      mealLoggedDays: mealDates.length,
      proteinHitDays,
      predictionDays,
      dataCompleteness: Math.max(0, Math.min(100, dataCompleteness)),
    },
    risks,
  };
}

export function calculateWeeklyReportScore(context: WeeklyMetricsContext): number {
  const { metrics, risks } = context;
  const weightScore = metrics.weightChange === undefined ? 12 : metrics.weightChange < 0 ? 25 : metrics.weightChange <= 0.2 ? 18 : 10;
  const riskPenalty = Math.min(15, risks.length * 6);
  const calorieScore = Math.max(0, 25 - riskPenalty);
  const proteinScore = Math.round(Math.min(100, metrics.proteinHitRate) / 100 * 25);
  const checkinScore = Math.round(metrics.completedDays / 7 * 15);
  const dataScore = Math.round(metrics.dataCompleteness / 100 * 10);
  return Math.max(0, Math.min(100, weightScore + calorieScore + proteinScore + checkinScore + dataScore));
}

export async function generateWeeklyReport(userId: string, weekIndex?: number, force = false): Promise<WeeklyReport> {
  const prisma = getPrisma();
  const context = await collectWeeklyReportMetrics(userId, weekIndex);

  if (!force) {
    const existing = await prisma.weeklyReport.findUnique({
      where: { userId_weekIndex: { userId, weekIndex: context.weekIndex } },
    });
    if (existing) return weeklyReportRecordToDto(existing);
  }

  const score = calculateWeeklyReportScore(context);
  const content = await generateWeeklyReportContent(context, score);
  const report = await prisma.weeklyReport.upsert({
    where: { userId_weekIndex: { userId, weekIndex: context.weekIndex } },
    create: {
      userId,
      weekIndex: context.weekIndex,
      startDate: toDate(context.weekStartDate),
      endDate: toDate(context.weekEndDate),
      score,
      summary: content.summary,
      suggestions: content.suggestions as unknown as Prisma.InputJsonValue,
      metrics: { ...context.metrics, headline: content.headline } as unknown as Prisma.InputJsonValue,
      risks: context.risks as unknown as Prisma.InputJsonValue,
    },
    update: {
      score,
      summary: content.summary,
      suggestions: content.suggestions as unknown as Prisma.InputJsonValue,
      metrics: { ...context.metrics, headline: content.headline } as unknown as Prisma.InputJsonValue,
      risks: context.risks as unknown as Prisma.InputJsonValue,
    },
  });

  return weeklyReportRecordToDto(report);
}

async function generateWeeklyReportContent(context: WeeklyMetricsContext, score: number): Promise<WeeklyReportContent> {
  try {
    const response = await askDeepSeek([
      {
        role: 'system',
        content: [
          '你是 Coach Zero，一位温柔、稳定、专业的 AI 减脂教练。',
          '请基于用户一周数据生成中文减脂周报。',
          '只使用传入指标，不虚构饮食、训练或体重。',
          '先肯定执行，再指出一个最小改进点。',
          '风险表达使用“风险/波动/需要留意”，不要使用“失败/失控”。',
          '语气温柔，不羞辱、不恐吓、不制造焦虑，不做医疗诊断。',
          '只输出 JSON，格式为 {"headline":"...","summary":"...","suggestions":["..."]}。',
          'headline 24字以内，summary 120字以内，suggestions 1-3条，每条26字以内。',
        ].join('\n'),
      },
      { role: 'user', content: JSON.stringify({ score, context }, null, 2) },
    ]);
    return normalizeGeneratedContent(parseJsonObject(response));
  } catch {
    return buildFallbackWeeklyReport(context, score);
  }
}

export function buildFallbackWeeklyReport(context: WeeklyMetricsContext, score: number): WeeklyReportContent {
  const { metrics, risks } = context;
  const changeText = metrics.weightChange === undefined ? '体重趋势还需要更多记录' : `本周体重变化 ${metrics.weightChange.toFixed(1)}kg`;
  const summary = [
    `本周评分 ${score} 分。`,
    changeText,
    `，平均热量约 ${metrics.averageCalories} kcal，蛋白达标率 ${metrics.proteinHitRate}%。`,
    risks.length ? `有 ${risks.length} 次热量偏高风险，需要温和拉回节奏。` : '整体执行节奏比较稳定。',
  ].join('');
  const suggestions = [
    metrics.proteinHitRate < 80 ? '提高早餐蛋白质比例。' : '',
    risks.length ? '高风险日先补水和蔬菜。' : '',
    metrics.completedDays < 5 ? '下周先争取完成 5 天打卡。' : '',
  ].filter(Boolean).slice(0, 3);

  return {
    headline: risks.length ? '本周有波动，但节奏还能找回' : '本周执行节奏稳住了',
    summary,
    suggestions: suggestions.length ? suggestions : ['下周继续保持记录和蛋白质摄入。'],
  };
}

export function weeklyReportRecordToDto(report: {
  id: string;
  userId: string;
  weekIndex: number;
  startDate: Date;
  endDate: Date;
  score: number;
  summary: string;
  suggestions: unknown;
  metrics: unknown;
  risks: unknown;
  readAt: Date | null;
  createdAt: Date;
}): WeeklyReport {
  const metrics = normalizeMetrics(report.metrics);
  const headline = typeof (report.metrics as { headline?: unknown })?.headline === 'string'
    ? (report.metrics as { headline: string }).headline
    : undefined;

  return {
    id: report.id,
    userId: report.userId,
    weekIndex: report.weekIndex,
    startDate: dateToISODate(report.startDate),
    endDate: dateToISODate(report.endDate),
    score: Math.max(0, Math.min(100, Math.round(report.score))),
    summary: report.summary,
    headline,
    suggestions: normalizeSuggestions(report.suggestions),
    metrics,
    risks: normalizeRisks(report.risks),
    readAt: report.readAt?.toISOString(),
    createdAt: report.createdAt.toISOString(),
  };
}

function groupMealsByDate(meals: WeeklyMealRecord[]) {
  const byDate = new Map<string, WeeklyMealRecord[]>();
  for (const meal of meals) {
    const date = meal.date instanceof Date ? dateToISODate(meal.date) : meal.date;
    byDate.set(date, [...(byDate.get(date) || []), meal]);
  }
  return byDate;
}

function getLongestStreak(days: { date: string; completed: boolean }[]) {
  let longest = 0;
  let current = 0;
  for (const day of days.sort((a, b) => a.date.localeCompare(b.date))) {
    current = day.completed ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function getPredictionDays(weightChange: number | undefined, goalWeight: number, endWeight: number | undefined) {
  if (weightChange === undefined || endWeight === undefined || weightChange >= 0 || endWeight <= goalWeight) return undefined;
  const weeklyLoss = Math.abs(weightChange);
  return Math.max(1, Math.ceil((endWeight - goalWeight) / weeklyLoss * 7));
}

function parseJsonObject(content: string): unknown {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Invalid weekly report JSON');
  return JSON.parse(content.slice(start, end + 1));
}

function normalizeGeneratedContent(value: unknown): WeeklyReportContent {
  if (!value || typeof value !== 'object') throw new Error('Invalid weekly report content');
  const source = value as { headline?: unknown; summary?: unknown; suggestions?: unknown };
  const headline = typeof source.headline === 'string' ? source.headline.trim() : '';
  const summary = typeof source.summary === 'string' ? source.summary.trim() : '';
  const suggestions = normalizeSuggestions(source.suggestions);
  if (!headline || !summary || !suggestions.length) throw new Error('Empty weekly report content');
  return { headline, summary, suggestions: suggestions.slice(0, 3) };
}

function normalizeSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 3);
}

function normalizeRisks(value: unknown): WeeklyReportRisk[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WeeklyReportRisk => Boolean(item) && typeof item === 'object' && 'date' in item && 'message' in item);
}

function normalizeMetrics(value: unknown): WeeklyReportMetrics {
  const source = value && typeof value === 'object' ? value as Partial<WeeklyReportMetrics> : {};
  return {
    startWeight: typeof source.startWeight === 'number' ? source.startWeight : undefined,
    endWeight: typeof source.endWeight === 'number' ? source.endWeight : undefined,
    weightChange: typeof source.weightChange === 'number' ? source.weightChange : undefined,
    averageCalories: typeof source.averageCalories === 'number' ? source.averageCalories : 0,
    averageProtein: typeof source.averageProtein === 'number' ? source.averageProtein : 0,
    proteinHitRate: typeof source.proteinHitRate === 'number' ? source.proteinHitRate : 0,
    completedDays: typeof source.completedDays === 'number' ? source.completedDays : 0,
    longestStreak: typeof source.longestStreak === 'number' ? source.longestStreak : 0,
    mealLoggedDays: typeof source.mealLoggedDays === 'number' ? source.mealLoggedDays : 0,
    proteinHitDays: typeof source.proteinHitDays === 'number' ? source.proteinHitDays : 0,
    predictionDays: typeof source.predictionDays === 'number' ? source.predictionDays : undefined,
    dataCompleteness: typeof source.dataCompleteness === 'number' ? source.dataCompleteness : 0,
  };
}
