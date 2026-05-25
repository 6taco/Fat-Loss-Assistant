import { create } from 'zustand';
import { getJson } from '@/lib/client-api';
import { calculateMealCalories, DailyReport, DayPlan, MealLog, UserProfile, WeightEntry } from '@/lib/mock-data';
import { getActiveAccount, getScopedKey } from '@/lib/accounts';
import { getItem, KEYS, setItem } from '@/lib/storage';

interface DailyReportState {
  reports: DailyReport[];
  latestReport: DailyReport | null;
  isLoading: boolean;
  error: string;
  loadReports: () => void;
  ensureLatestReport: () => void;
  generateReport: (date?: string, force?: boolean) => Promise<DailyReport | null>;
}

function getLocalUserId() {
  const account = getActiveAccount();
  if (!account) return null;
  return getItem<UserProfile | null>(getScopedKey(KEYS.USER), null)?.id || account.id;
}

function getShanghaiDate(offsetDays = 0): string {
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

function sortReports(reports: DailyReport[]) {
  return [...reports].sort((a, b) => b.date.localeCompare(a.date));
}

function setReportState(set: (state: Partial<DailyReportState>) => void, reports: DailyReport[]) {
  const sorted = sortReports(reports);
  setItem(getScopedKey(KEYS.DAILY_REPORTS), sorted);
  set({ reports: sorted, latestReport: sorted[0] || null });
}

export const useDailyReportStore = create<DailyReportState>((set, get) => ({
  reports: [],
  latestReport: null,
  isLoading: false,
  error: '',

  loadReports: () => {
    const localReports = sortReports(getItem<DailyReport[]>(getScopedKey(KEYS.DAILY_REPORTS), []));
    set({ reports: localReports, latestReport: localReports[0] || null, error: '' });

    const userId = getLocalUserId();
    if (!userId) return;

    set({ isLoading: true });
    void getJson<{ reports: DailyReport[] }>(`/api/daily-reports?userId=${encodeURIComponent(userId)}&limit=7`).then((data) => {
      if (data?.reports) setReportState(set, data.reports);
      set({ isLoading: false });
    });
  },

  ensureLatestReport: () => {
    const userId = getLocalUserId();
    if (!userId) return;

    const reportDate = getShanghaiDate(-1);
    const existing = get().reports.find(report => report.date === reportDate);
    if (existing) {
      set({ latestReport: existing, error: '' });
      return;
    }

    set({ isLoading: true, error: '' });
    void get().generateReport(reportDate, false);
  },

  generateReport: async (date = getLatestReviewableDate() || getShanghaiDate(-1), force = false) => {
    const userId = getLocalUserId();
    if (!userId) return null;

    set({ isLoading: true, error: '' });
    try {
      const response = await fetch('/api/daily-reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, force }),
      });
      const data = await response.json() as { report?: DailyReport | null; error?: string; code?: string; source?: string; warning?: string };

      if (data.source === 'local' && !data.report) {
        const fallbackReport = buildLocalDailyReport(userId, date);
        if (!fallbackReport) {
          set({ isLoading: false, error: '还没有足够数据生成日报。先记录一餐、体重或完成一次打卡就好。' });
          return null;
        }

        const reports = sortReports([fallbackReport, ...get().reports.filter(report => report.id !== fallbackReport.id)]);
        setReportState(set, reports);
        set({ isLoading: false, error: '' });
        return fallbackReport;
      }

      if (!response.ok || !data.report) {
        const message = data.code === 'REPORT_NOT_READY' && data.error
          ? data.error
          : '日报暂时生成失败，稍后会自动重试';
        set({ isLoading: false, error: message });
        return null;
      }

      const generatedReport = data.report;
      const reports = sortReports([generatedReport, ...get().reports.filter(report => report.id !== generatedReport.id)]);
      setReportState(set, reports);
      set({ isLoading: false, error: '' });
      return generatedReport;
    } catch {
      set({ isLoading: false, error: '日报暂时生成失败，稍后会自动重试' });
      return null;
    }
  },
}));

function buildLocalDailyReport(userId: string, date: string): DailyReport | null {
  const user = getItem<UserProfile | null>(getScopedKey(KEYS.USER), null);
  const plans = getItem<DayPlan[]>(getScopedKey(KEYS.PLAN), []);
  const meals = getItem<MealLog[]>(getScopedKey(KEYS.MEALS), []);
  const weights = getItem<WeightEntry[]>(getScopedKey(KEYS.WEIGHT), []);
  const plan = plans.find(item => item.date === date);
  const dayMeals = meals.filter(item => item.date === date);
  const weight = weights.find(item => item.date === date);

  if (!plan && dayMeals.length === 0 && !weight) return null;

  const calories = dayMeals.reduce((sum, meal) => sum + (meal.calories ?? calculateMealCalories(meal)), 0);
  const protein = dayMeals.reduce((sum, meal) => sum + meal.protein, 0);
  const proteinRate = plan?.protein ? protein / plan.protein : undefined;
  const calorieRate = plan?.calories ? calories / plan.calories : undefined;
  const score = Math.max(0, Math.min(100,
    (proteinRate === undefined ? 18 : Math.min(35, Math.round(proteinRate * 35))) +
    (calorieRate === undefined ? 15 : calorieRate <= 1.1 ? 30 : calorieRate <= 1.3 ? 20 : 10) +
    (plan?.completed ? 20 : 0) +
    (plan ? 5 : 0) + (dayMeals.length ? 5 : 0) + (weight ? 5 : 0),
  ));

  const summaryParts = [
    `今日评分 ${score} 分。`,
    weight ? `体重记录为 ${weight.weight}kg。` : '今天还没有体重记录。 ',
    dayMeals.length ? `已记录约 ${Math.round(calories)} kcal，蛋白质约 ${Math.round(protein)}g。` : '饮食数据还不完整。 ',
    plan?.completed ? '今天完成了打卡。' : '今天还没完成打卡也没关系，明天接着来。',
  ];

  const suggestions = [
    !dayMeals.length ? '明天先记录一餐就很好。' : '',
    proteinRate === undefined || proteinRate < 0.9 ? '明天优先补足一份蛋白质。' : '',
    !plan?.completed ? '明天完成一个小打卡。' : '',
  ].filter(Boolean).slice(0, 3);

  return {
    id: `local-report-${userId}-${date}`,
    userId: user?.id || userId,
    date,
    score,
    summary: summaryParts.join(''),
    suggestions: suggestions.length ? suggestions : ['明天继续保持记录节奏。'],
    createdAt: new Date().toISOString(),
  };
}

function getLatestReviewableDate(): string | null {
  const today = getShanghaiDate(0);
  const user = getItem<UserProfile | null>(getScopedKey(KEYS.USER), null);
  const plans = getItem<DayPlan[]>(getScopedKey(KEYS.PLAN), []);
  const meals = getItem<MealLog[]>(getScopedKey(KEYS.MEALS), []);
  const weights = getItem<WeightEntry[]>(getScopedKey(KEYS.WEIGHT), []);
  const dates = new Set<string>();

  for (const plan of plans) {
    if (plan.date <= today && (!user?.startDate || plan.date >= user.startDate)) dates.add(plan.date);
  }
  for (const meal of meals) {
    if (meal.date <= today && (!user?.startDate || meal.date >= user.startDate)) dates.add(meal.date);
  }
  for (const weight of weights) {
    if (weight.date <= today && (!user?.startDate || weight.date >= user.startDate)) dates.add(weight.date);
  }

  return [...dates].sort((a, b) => b.localeCompare(a))[0] || null;
}
