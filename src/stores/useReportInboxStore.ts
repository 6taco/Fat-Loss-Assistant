import { create } from 'zustand';
import { getJson, sendJson } from '@/lib/client-api';
import {
  calculateMealCalories,
  DailyReport,
  DayPlan,
  MealLog,
  UserProfile,
  WeightEntry,
  WeeklyReport,
  WeeklyReportRisk,
} from '@/lib/mock-data';
import { getActiveAccount, getScopedKey } from '@/lib/accounts';
import { getItem, KEYS, setItem } from '@/lib/storage';

interface ReportInboxState {
  dailyReports: DailyReport[];
  weeklyReports: WeeklyReport[];
  isLoading: boolean;
  error: string;
  loadReports: () => void;
  generateWeeklyReport: (force?: boolean) => Promise<WeeklyReport | null>;
  markRead: (type: 'daily' | 'weekly', id: string) => void;
}

function getLocalUserId() {
  const account = getActiveAccount();
  if (!account) return null;
  return getItem<UserProfile | null>(getScopedKey(KEYS.USER), null)?.id || account.id;
}

function sortDaily(reports: DailyReport[]) {
  return [...reports].sort((a, b) => b.date.localeCompare(a.date));
}

function sortWeekly(reports: WeeklyReport[]) {
  return [...reports].sort((a, b) => b.weekIndex - a.weekIndex);
}

export const useReportInboxStore = create<ReportInboxState>((set, get) => ({
  dailyReports: [],
  weeklyReports: [],
  isLoading: false,
  error: '',

  loadReports: () => {
    const localDaily = sortDaily(getItem<DailyReport[]>(getScopedKey(KEYS.DAILY_REPORTS), []));
    const localWeekly = sortWeekly(getItem<WeeklyReport[]>(getScopedKey(KEYS.WEEKLY_REPORTS), []));
    set({ dailyReports: localDaily, weeklyReports: localWeekly, error: '' });

    const userId = getLocalUserId();
    if (!userId) return;

    set({ isLoading: true });
    void Promise.all([
      getJson<{ reports: DailyReport[] }>(`/api/daily-reports?userId=${encodeURIComponent(userId)}&limit=14`),
      getJson<{ reports: WeeklyReport[] }>(`/api/weekly-reports?userId=${encodeURIComponent(userId)}&limit=8`),
    ]).then(([daily, weekly]) => {
      if (daily?.reports) {
        const reports = sortDaily(daily.reports);
        setItem(getScopedKey(KEYS.DAILY_REPORTS), reports);
        set({ dailyReports: reports });
      }
      if (weekly?.reports) {
        const reports = sortWeekly(weekly.reports);
        setItem(getScopedKey(KEYS.WEEKLY_REPORTS), reports);
        set({ weeklyReports: reports });
      }
      set({ isLoading: false });
    });
  },

  generateWeeklyReport: async (force = false) => {
    const userId = getLocalUserId();
    if (!userId) return null;

    set({ isLoading: true, error: '' });
    try {
      const response = await fetch('/api/weekly-reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, force }),
      });
      const data = await response.json() as { report?: WeeklyReport | null; source?: string; error?: string; code?: string };

      if (data.source === 'local' && !data.report) {
        const fallback = buildLocalWeeklyReport(userId);
        if (!fallback) {
          set({ isLoading: false, error: '这一周还没有足够数据生成周报。' });
          return null;
        }
        const reports = sortWeekly([fallback, ...get().weeklyReports.filter(report => report.id !== fallback.id)]);
        setItem(getScopedKey(KEYS.WEEKLY_REPORTS), reports);
        set({ weeklyReports: reports, isLoading: false });
        return fallback;
      }

      if (!response.ok || !data.report) {
        set({ isLoading: false, error: data.error || '周报暂时生成失败。' });
        return null;
      }

      const reports = sortWeekly([data.report, ...get().weeklyReports.filter(report => report.id !== data.report!.id)]);
      setItem(getScopedKey(KEYS.WEEKLY_REPORTS), reports);
      set({ weeklyReports: reports, isLoading: false });
      return data.report;
    } catch {
      const fallback = buildLocalWeeklyReport(userId);
      if (!fallback) {
        set({ isLoading: false, error: '这一周还没有足够数据生成周报。' });
        return null;
      }
      const reports = sortWeekly([fallback, ...get().weeklyReports.filter(report => report.id !== fallback.id)]);
      setItem(getScopedKey(KEYS.WEEKLY_REPORTS), reports);
      set({ weeklyReports: reports, isLoading: false });
      return fallback;
    }
  },

  markRead: (type, id) => {
    const readAt = new Date().toISOString();
    const userId = getLocalUserId();

    if (type === 'daily') {
      const reports = get().dailyReports.map(report => report.id === id ? { ...report, readAt } : report);
      setItem(getScopedKey(KEYS.DAILY_REPORTS), reports);
      set({ dailyReports: reports });
    } else {
      const reports = get().weeklyReports.map(report => report.id === id ? { ...report, readAt } : report);
      setItem(getScopedKey(KEYS.WEEKLY_REPORTS), reports);
      set({ weeklyReports: reports });
    }

    if (userId) void sendJson('/api/reports/read', 'PATCH', { userId, type, id });
  },
}));

function buildLocalWeeklyReport(userId: string): WeeklyReport | null {
  const user = getItem<UserProfile | null>(getScopedKey(KEYS.USER), null);
  if (!user) return null;

  const weekIndex = getCurrentWeekIndex(user.startDate);
  const { startDate, endDate } = getWeekRange(user.startDate, weekIndex);
  const plans = getItem<DayPlan[]>(getScopedKey(KEYS.PLAN), []).filter(plan => plan.date >= startDate && plan.date <= endDate);
  const meals = getItem<MealLog[]>(getScopedKey(KEYS.MEALS), []).filter(meal => meal.date >= startDate && meal.date <= endDate);
  const weights = getItem<WeightEntry[]>(getScopedKey(KEYS.WEIGHT), []).filter(entry => entry.date >= startDate && entry.date <= endDate);
  if (!plans.length && !meals.length && !weights.length) return null;

  const planByDate = new Map(plans.map(plan => [plan.date, plan]));
  const mealsByDate = new Map<string, MealLog[]>();
  for (const meal of meals) mealsByDate.set(meal.date, [...(mealsByDate.get(meal.date) || []), meal]);

  const risks: WeeklyReportRisk[] = [];
  let totalCalories = 0;
  let totalProtein = 0;
  let proteinHitDays = 0;
  const mealDates = [...mealsByDate.keys()];

  for (const date of mealDates) {
    const dayMeals = mealsByDate.get(date) || [];
    const calories = dayMeals.reduce((sum, meal) => sum + (meal.calories ?? calculateMealCalories(meal)), 0);
    const protein = dayMeals.reduce((sum, meal) => sum + meal.protein, 0);
    const plan = planByDate.get(date);
    totalCalories += calories;
    totalProtein += protein;
    if (plan?.protein && protein / plan.protein >= 0.9) proteinHitDays += 1;
    if (plan?.calories && calories > plan.calories * 1.3) {
      risks.push({ date, type: 'binge', message: `当天热量约 ${Math.round(calories)} kcal，超过目标 30%。` });
    }
  }

  const startWeight = weights[0]?.weight;
  const endWeight = weights[weights.length - 1]?.weight;
  const weightChange = startWeight !== undefined && endWeight !== undefined ? endWeight - startWeight : undefined;
  const completedDays = plans.filter(plan => plan.completed).length;
  const proteinHitRate = mealDates.length ? Math.round(proteinHitDays / mealDates.length * 100) : 0;
  const score = Math.max(0, Math.min(100,
    (weightChange === undefined ? 12 : weightChange < 0 ? 25 : 12) +
    Math.max(0, 25 - risks.length * 6) +
    Math.round(proteinHitRate / 100 * 25) +
    Math.round(completedDays / 7 * 15) +
    Math.round(((plans.length ? 1 : 0) + (mealDates.length / 7) + (weights.length ? 1 : 0)) / 3 * 10),
  ));
  const predictionDays = weightChange !== undefined && weightChange < 0 && endWeight && endWeight > user.goalWeight
    ? Math.ceil((endWeight - user.goalWeight) / Math.abs(weightChange) * 7)
    : undefined;

  return {
    id: `local-weekly-${userId}-${weekIndex}`,
    userId,
    weekIndex,
    startDate,
    endDate,
    score,
    summary: `本周评分 ${score} 分。${weightChange !== undefined ? `体重变化 ${weightChange.toFixed(1)}kg。` : '体重趋势还需要更多记录。'}平均热量约 ${mealDates.length ? Math.round(totalCalories / mealDates.length) : 0} kcal，蛋白达标率 ${proteinHitRate}%。`,
    headline: risks.length ? '本周有波动，但节奏还能找回' : '本周执行节奏稳住了',
    suggestions: [
      proteinHitRate < 80 ? '提高早餐蛋白质比例。' : '',
      risks.length ? '高风险日先补水和蔬菜。' : '',
      completedDays < 5 ? '下周先争取完成 5 天打卡。' : '',
    ].filter(Boolean).slice(0, 3),
    metrics: {
      startWeight,
      endWeight,
      weightChange,
      averageCalories: mealDates.length ? Math.round(totalCalories / mealDates.length) : 0,
      averageProtein: mealDates.length ? Math.round(totalProtein / mealDates.length) : 0,
      proteinHitRate,
      completedDays,
      longestStreak: getLongestStreak(plans),
      mealLoggedDays: mealDates.length,
      proteinHitDays,
      predictionDays,
      dataCompleteness: Math.round(((plans.length ? 1 : 0) + (mealDates.length / 7) + (weights.length ? 1 : 0)) / 3 * 100),
    },
    risks,
    createdAt: new Date().toISOString(),
  };
}

function getCurrentWeekIndex(startDate: string) {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(1, Math.floor((current - start) / 86400000 / 7) + 1);
}

function getWeekRange(userStartDate: string, weekIndex: number) {
  const start = new Date(`${userStartDate}T00:00:00`);
  start.setDate(start.getDate() + (weekIndex - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function getLongestStreak(plans: DayPlan[]) {
  let longest = 0;
  let current = 0;
  for (const plan of [...plans].sort((a, b) => a.date.localeCompare(b.date))) {
    current = plan.completed ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}
