import { Prisma } from '@prisma/client';
import { askDeepSeek } from '@/lib/deepseek';
import { getPrisma } from '@/lib/prisma';
import { dateToISODate, toDate } from '@/lib/server-mappers';
import { calculateMealCalories, type CarbType, type DailyReport } from '@/lib/mock-data';

export interface DailyReportMetrics {
  userId: string;
  userName: string;
  date: string;
  tomorrowDate: string;
  weight?: number;
  previousWeight?: number;
  weightDelta?: number;
  caloriesConsumed: number;
  proteinConsumed: number;
  calorieTarget?: number;
  proteinTarget?: number;
  calorieCompletionRate?: number;
  proteinCompletionRate?: number;
  completed: boolean;
  hasPlan: boolean;
  hasWeight: boolean;
  hasMeals: boolean;
  carbType?: CarbType;
  tomorrowCarbType?: CarbType;
  tomorrowTrainingLabel?: string;
}

export class DailyReportNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyReportNotReadyError';
  }
}

interface GeneratedReportContent {
  summary: string;
  suggestions: string[];
}

export function getShanghaiDate(offsetDays = 0): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return formatter.format(now);
}

export function getReportDateForCron(): string {
  return getShanghaiDate(-1);
}

export function getTomorrowDate(date: string): string {
  const next = toDate(date);
  next.setDate(next.getDate() + 1);
  return dateToISODate(next);
}

export async function collectDailyReportMetrics(userId: string, date: string): Promise<DailyReportMetrics> {
  const prisma = getPrisma();
  const reportDate = toDate(date);
  const tomorrowDate = getTomorrowDate(date);

  const [user, todayPlan, tomorrowPlan, meals, todayWeight, previousWeight] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.dayPlan.findUnique({ where: { userId_date: { userId, date: reportDate } } }),
    prisma.dayPlan.findUnique({ where: { userId_date: { userId, date: toDate(tomorrowDate) } } }),
    prisma.mealLog.findMany({ where: { userId, date: reportDate } }),
    prisma.weightEntry.findUnique({ where: { userId_date: { userId, date: reportDate } } }),
    prisma.weightEntry.findFirst({
      where: { userId, date: { lt: reportDate } },
      orderBy: { date: 'desc' },
    }),
  ]);

  if (!user) {
    throw new Error('User not found');
  }

  if (reportDate < user.startDate) {
    throw new DailyReportNotReadyError('你昨天还没有开始使用减脂助手，先从今天记录一餐或完成一次打卡开始。');
  }

  const caloriesConsumed = meals.reduce((sum, meal) => sum + (meal.calories ?? calculateMealCalories(meal)), 0);
  const proteinConsumed = meals.reduce((sum, meal) => sum + meal.protein, 0);
  const calorieTarget = todayPlan?.calories;
  const proteinTarget = todayPlan?.protein;
  const weightDelta = todayWeight && previousWeight ? todayWeight.weight - previousWeight.weight : undefined;

  const metrics = {
    userId,
    userName: user.name,
    date,
    tomorrowDate,
    weight: todayWeight?.weight,
    previousWeight: previousWeight?.weight,
    weightDelta,
    caloriesConsumed,
    proteinConsumed,
    calorieTarget,
    proteinTarget,
    calorieCompletionRate: calorieTarget ? caloriesConsumed / calorieTarget : undefined,
    proteinCompletionRate: proteinTarget ? proteinConsumed / proteinTarget : undefined,
    completed: todayPlan?.completed ?? false,
    hasPlan: Boolean(todayPlan),
    hasWeight: Boolean(todayWeight),
    hasMeals: meals.length > 0,
    carbType: todayPlan?.carbType,
    tomorrowCarbType: tomorrowPlan?.carbType,
    tomorrowTrainingLabel: tomorrowPlan?.trainingLabel || undefined,
  };

  if (!metrics.hasPlan && !metrics.hasWeight && !metrics.hasMeals) {
    throw new DailyReportNotReadyError('昨天还没有可复盘的数据。先记录一餐、体重或完成一次打卡后，我再帮你生成日报。');
  }

  return metrics;
}

export function calculateReportScore(metrics: DailyReportMetrics): number {
  const proteinScore = metrics.proteinCompletionRate === undefined
    ? 18
    : clamp(metrics.proteinCompletionRate, 0, 1.15) >= 0.9
      ? 35
      : Math.round(clamp(metrics.proteinCompletionRate, 0, 0.9) / 0.9 * 35);

  const calorieScore = metrics.calorieCompletionRate === undefined
    ? 15
    : scoreCalories(metrics.calorieCompletionRate);

  const completionScore = metrics.completed ? 20 : 0;
  const dataScore = (metrics.hasPlan ? 5 : 0) + (metrics.hasWeight ? 5 : 0) + (metrics.hasMeals ? 5 : 0);

  return Math.max(0, Math.min(100, proteinScore + calorieScore + completionScore + dataScore));
}

export async function generateDailyReport(userId: string, date = getReportDateForCron(), force = false): Promise<DailyReport> {
  const prisma = getPrisma();
  const reportDate = toDate(date);

  if (!force) {
    const existing = await prisma.dailyReport.findUnique({
      where: { userId_date: { userId, date: reportDate } },
    });
    if (existing) return dailyReportRecordToDto(existing);
  }

  const metrics = await collectDailyReportMetrics(userId, date);
  const score = calculateReportScore(metrics);
  const content = await generateDailyReportContent(metrics, score);

  const report = await prisma.dailyReport.upsert({
    where: { userId_date: { userId, date: reportDate } },
    create: {
      userId,
      date: reportDate,
      score,
      summary: content.summary,
      suggestions: content.suggestions as unknown as Prisma.InputJsonValue,
    },
    update: {
      score,
      summary: content.summary,
      suggestions: content.suggestions as unknown as Prisma.InputJsonValue,
    },
  });

  return dailyReportRecordToDto(report);
}

async function generateDailyReportContent(metrics: DailyReportMetrics, score: number): Promise<GeneratedReportContent> {
  try {
    const response = await askDeepSeek([
      {
        role: 'system',
        content: [
          '你是 Coach Zero，一位温柔、稳定、专业的 AI 减脂教练。',
          '请基于用户当天数据生成一份中文减脂收盘日报。',
          '只使用传入指标，不虚构饮食、训练或体重。',
          '先肯定做得好的地方，再指出一个最小改进点。',
          '语气温柔，不羞辱、不恐吓、不制造焦虑，不做医疗诊断。',
          '只输出 JSON，格式为 {"summary":"...","suggestions":["..."]}。',
          'summary 80 字以内，suggestions 1-3 条，每条 24 字以内。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({ score, metrics }, null, 2),
      },
    ]);

    return normalizeGeneratedContent(parseJsonObject(response));
  } catch {
    return buildFallbackDailyReport(metrics, score);
  }
}

export function buildFallbackDailyReport(metrics: DailyReportMetrics, score: number): GeneratedReportContent {
  const parts: string[] = [];

  if (metrics.weightDelta !== undefined) {
    const direction = metrics.weightDelta < 0 ? '下降' : metrics.weightDelta > 0 ? '上升' : '基本持平';
    parts.push(`今日体重较上次${direction}${Math.abs(metrics.weightDelta).toFixed(1)}kg。`);
  } else {
    parts.push('今天体重数据还不完整，先不用急着评价自己。');
  }

  if (metrics.proteinCompletionRate !== undefined) {
    parts.push(`蛋白质完成约${Math.round(metrics.proteinCompletionRate * 100)}%。`);
  }

  if (metrics.hasMeals && metrics.calorieCompletionRate !== undefined) {
    parts.push(metrics.calorieCompletionRate <= 1.1 ? '整体饮食控制比较稳。' : '今天热量略高，明天轻轻拉回节奏就好。');
  }

  const suggestions: string[] = [];
  if (!metrics.hasMeals) suggestions.push('明天先记录一餐就很好。');
  if (metrics.proteinCompletionRate === undefined || metrics.proteinCompletionRate < 0.9) suggestions.push('明天优先补足一份蛋白质。');
  if (!metrics.completed) suggestions.push('明天完成一个小打卡就算前进。');
  if (metrics.tomorrowTrainingLabel) suggestions.push(`明天${metrics.tomorrowTrainingLabel}，训练前后安排主食。`);

  return {
    summary: `今日评分 ${score} 分。${parts.join('')}`,
    suggestions: suggestions.slice(0, 3),
  };
}

export function dailyReportRecordToDto(report: {
  id: string;
  userId: string;
  date: Date;
  score: number;
  summary: string;
  suggestions: unknown;
  createdAt: Date;
}): DailyReport {
  return {
    id: report.id,
    userId: report.userId,
    date: dateToISODate(report.date),
    score: Math.max(0, Math.min(100, Math.round(report.score))),
    summary: report.summary,
    suggestions: normalizeSuggestions(report.suggestions),
    createdAt: report.createdAt.toISOString(),
  };
}

function scoreCalories(rate: number): number {
  if (rate <= 0) return 0;
  if (rate >= 0.85 && rate <= 1.08) return 30;
  if (rate < 0.85) return Math.round(rate / 0.85 * 24);
  if (rate <= 1.2) return 24;
  if (rate <= 1.35) return 16;
  return 8;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Invalid JSON report');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function normalizeGeneratedContent(value: unknown): GeneratedReportContent {
  if (!value || typeof value !== 'object') throw new Error('Invalid report content');
  const source = value as { summary?: unknown; suggestions?: unknown };
  const summary = typeof source.summary === 'string' ? source.summary.trim() : '';
  const suggestions = normalizeSuggestions(source.suggestions);
  if (!summary || suggestions.length === 0) throw new Error('Empty report content');
  return { summary, suggestions: suggestions.slice(0, 3) };
}

function normalizeSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}
