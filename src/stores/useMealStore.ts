import { create } from 'zustand';
import { track } from '@/lib/analytics/client';
import { getJson, sendJson } from '@/lib/client-api';
import { calculateMealCalories, MealLog, sumMealMacros, UserProfile } from '@/lib/mock-data';
import { getItem, KEYS, setItem } from '@/lib/storage';
import { getScopedKey } from '@/lib/accounts';

interface MealState {
  meals: MealLog[];
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

  loadMeals: () => {
    const storageKey = getScopedKey(KEYS.MEALS);
    console.log('[loadMeals] Storage key:', storageKey);

    const localMeals = sortMeals(getItem<MealLog[]>(storageKey, []).map(normalizeMeal));
    console.log('[loadMeals] Loaded from localStorage:', localMeals.length, 'meals');
    console.log('[loadMeals] Meal dates:', localMeals.map(m => ({ id: m.id, date: m.date })));

    set({ meals: localMeals });

    const userId = getLocalUserId();
    console.log('[loadMeals] User ID:', userId);

    if (!userId) return;

    void getJson<{ meals: MealLog[] }>(`/api/meal-logs?userId=${encodeURIComponent(userId)}`).then((data) => {
      if (!data?.meals) return;

      console.log('[loadMeals] Server response:', data.meals);
      console.log('[loadMeals] Server meal dates (raw):', data.meals.map(m => ({ id: m.id, date: m.date })));

      const serverMeals = data.meals.map(normalizeMeal);
      console.log('[loadMeals] After normalize:', serverMeals.map(m => ({ id: m.id, date: m.date })));

      const currentLocalMeals = getItem<MealLog[]>(storageKey, []).map(normalizeMeal);
      console.log('[loadMeals] Current local before merge:', currentLocalMeals.map(m => ({ id: m.id, date: m.date })));

      const merged = mergeMeals(currentLocalMeals, serverMeals);
      console.log('[loadMeals] After merge:', merged.map(m => ({ id: m.id, date: m.date })));

      setItem(storageKey, merged);
      set({ meals: merged });
    }).catch((error) => {
      console.error('Failed to load meals from server:', error);
    });
  },

  addMeal: (meal) => {
    const nextMeal = normalizeMeal(meal);
    console.log('[addMeal] Adding meal:', { id: nextMeal.id, date: nextMeal.date, description: nextMeal.description });

    const meals = sortMeals([...get().meals, nextMeal]);
    console.log('[addMeal] Total meals after add:', meals.length);

    // 立即更新状态
    set({ meals });

    // 保存到localStorage
    const storageKey = getScopedKey(KEYS.MEALS);
    console.log('[addMeal] Saving to localStorage with key:', storageKey);

    try {
      setItem(storageKey, meals);
      console.log('[addMeal] Saved successfully');

      // 验证保存
      const verification = getItem<MealLog[]>(storageKey, []);
      console.log('[addMeal] Verification: localStorage now has', verification.length, 'meals');
    } catch (error) {
      console.error('Failed to save meal to localStorage:', error);
    }

    const userId = getLocalUserId();
    console.log('[addMeal] User ID:', userId);

    track('meal_log_create', {
      date: nextMeal.date,
      meal_type: nextMeal.mealType,
      calories: nextMeal.calories,
      source: nextMeal.source,
    }, { userId });

    // 异步保存到服务器
    if (userId) {
      void sendJson('/api/meal-logs', 'POST', { ...nextMeal, userId }).then(() => {
        console.log('[addMeal] Saved to server successfully');
      }).catch((error) => {
        console.error('Failed to save meal to server:', error);
      });
    }
  },

  updateMeal: (meal) => {
    const nextMeal = normalizeMeal({ ...meal, updatedAt: new Date().toISOString() });
    const meals = sortMeals(get().meals.map(item => item.id === nextMeal.id ? nextMeal : item));

    // 立即更新状态
    set({ meals });

    // 保存到localStorage
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

    // 立即更新状态
    set({ meals });

    // 保存到localStorage
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
