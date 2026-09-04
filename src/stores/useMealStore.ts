import { create } from 'zustand';
import { track } from '@/lib/analytics/client';
import { getJson, sendJson } from '@/lib/client-api';
import { MealLog, UserProfile } from '@/lib/types';
import { calculateMealCalories, sumMealMacros } from '@/lib/domain';
import { getItem, KEYS, setItem } from '@/lib/storage';
import { getScopedKey } from '@/lib/accounts';
import { isFreshData } from '@/lib/staleness';

interface MealState {
  meals: MealLog[];
  lastFetchedAt: number;
  loadMeals: () => void;
  addMeal: (meal: MealLog) => void;
  updateMeal: (meal: MealLog) => void;
  deleteMeal: (id: string) => void;
  getMealsByDate: (date: string) => MealLog[];
  getDailySummary: (date: string) => { carb: number; protein: number; fat: number; calories: number };
}

function getLocalUserId() {
  return getItem<UserProfile | null>(getScopedKey(KEYS.USER), null)?.id;
}

function sortMeals(meals: MealLog[]) {
  const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  return [...meals].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return order[a.mealType] - order[b.mealType] || a.createdAt.localeCompare(b.createdAt);
  });
}

function normalizeMeal(meal: MealLog): MealLog {
  return {
    ...meal,
    carb: Math.max(0, Number(meal.carb) || 0),
    protein: Math.max(0, Number(meal.protein) || 0),
    fat: Math.max(0, Number(meal.fat) || 0),
    calories: meal.calories ?? calculateMealCalories(meal),
  };
}

function mergeMeals(localMeals: MealLog[], serverMeals: MealLog[]) {
  const byId = new Map<string, MealLog>();

  // 先添加服务器数据
  for (const meal of serverMeals) byId.set(meal.id, meal);

  // 本地数据覆盖服务器数据（本地数据更可信，因为没有时区转换问题）
  for (const meal of localMeals) byId.set(meal.id, meal);

  return sortMeals([...byId.values()]);
}

export const useMealStore = create<MealState>((set, get) => ({
  meals: [],
  lastFetchedAt: 0,

  loadMeals: () => {
    if (isFreshData(get().lastFetchedAt)) return;
    const storageKey = getScopedKey(KEYS.MEALS);
    const localMeals = sortMeals(getItem<MealLog[]>(storageKey, []).map(normalizeMeal));
    set({ meals: localMeals });

    const userId = getLocalUserId();
    if (!userId) return;

    void getJson<{ meals: MealLog[] }>(`/api/meal-logs?userId=${encodeURIComponent(userId)}`).then((data) => {
      if (!data?.meals) return;
      const serverMeals = data.meals.map(normalizeMeal);
      const currentLocalMeals = getItem<MealLog[]>(storageKey, []).map(normalizeMeal);
      const merged = mergeMeals(currentLocalMeals, serverMeals);
      setItem(storageKey, merged);
      set({ meals: merged, lastFetchedAt: Date.now() });
    }).catch((error) => {
      console.error('Failed to load meals from server:', error);
    });
  },

  addMeal: (meal) => {
    const nextMeal = normalizeMeal(meal);
    const meals = sortMeals([...get().meals, nextMeal]);

    // 立即更新状态并保存到 localStorage
    set({ meals, lastFetchedAt: Date.now() });
    try {
      setItem(getScopedKey(KEYS.MEALS), meals);
    } catch (error) {
      console.error('Failed to save meal to localStorage:', error);
    }

    const userId = getLocalUserId();
    track('meal_log_create', {
      date: nextMeal.date,
      meal_type: nextMeal.mealType,
      calories: nextMeal.calories,
      source: nextMeal.source,
    }, { userId });

    // 异步保存到服务器
    if (userId) {
      void sendJson('/api/meal-logs', 'POST', { ...nextMeal, userId }).catch((error) => {
        console.error('Failed to save meal to server:', error);
      });
    }
  },

  updateMeal: (meal) => {
    const nextMeal = normalizeMeal({ ...meal, updatedAt: new Date().toISOString() });
    const meals = sortMeals(get().meals.map(item => item.id === nextMeal.id ? nextMeal : item));

    // 立即更新状态并保存到 localStorage
    set({ meals, lastFetchedAt: Date.now() });
    try {
      setItem(getScopedKey(KEYS.MEALS), meals);
    } catch (error) {
      console.error('Failed to update meal in localStorage:', error);
    }

    const userId = getLocalUserId();
    if (userId) {
      void sendJson('/api/meal-logs', 'PATCH', { ...nextMeal, userId }).catch((error) => {
        console.error('Failed to update meal on server:', error);
      });
    }
  },

  deleteMeal: (id) => {
    const meals = get().meals.filter(meal => meal.id !== id);

    // 立即更新状态并保存到 localStorage
    set({ meals, lastFetchedAt: Date.now() });
    try {
      setItem(getScopedKey(KEYS.MEALS), meals);
    } catch (error) {
      console.error('Failed to delete meal from localStorage:', error);
    }

    const userId = getLocalUserId();
    if (userId) {
      void sendJson('/api/meal-logs', 'DELETE', { id, userId }).catch((error) => {
        console.error('Failed to delete meal from server:', error);
      });
    }
  },

  getMealsByDate: (date) => get().meals.filter(meal => meal.date === date),

  getDailySummary: (date) => sumMealMacros(get().meals.filter(meal => meal.date === date)),
}));
