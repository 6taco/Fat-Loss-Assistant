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

export const useMealStore = create<MealState>((set, get) => ({
  meals: [],

  loadMeals: () => {
    const meals = sortMeals(getItem<MealLog[]>(getScopedKey(KEYS.MEALS), []).map(normalizeMeal));
    set({ meals });

    const userId = getLocalUserId();
    if (!userId) return;

    void getJson<{ meals: MealLog[] }>(`/api/meal-logs?userId=${encodeURIComponent(userId)}`).then((data) => {
      if (!data?.meals?.length) return;
      const sorted = sortMeals(data.meals.map(normalizeMeal));
      setItem(getScopedKey(KEYS.MEALS), sorted);
      set({ meals: sorted });
    });
  },

  addMeal: (meal) => {
    const nextMeal = normalizeMeal(meal);
    const meals = sortMeals([...get().meals, nextMeal]);
    setItem(getScopedKey(KEYS.MEALS), meals);
    set({ meals });

    const userId = getLocalUserId();
    track('meal_log_create', {
      date: nextMeal.date,
      meal_type: nextMeal.mealType,
      calories: nextMeal.calories,
      source: nextMeal.source,
    }, { userId });
    if (userId) void sendJson('/api/meal-logs', 'POST', { ...nextMeal, userId });
  },

  updateMeal: (meal) => {
    const nextMeal = normalizeMeal({ ...meal, updatedAt: new Date().toISOString() });
    const meals = sortMeals(get().meals.map(item => item.id === nextMeal.id ? nextMeal : item));
    setItem(getScopedKey(KEYS.MEALS), meals);
    set({ meals });

    const userId = getLocalUserId();
    if (userId) void sendJson('/api/meal-logs', 'PATCH', { ...nextMeal, userId });
  },

  deleteMeal: (id) => {
    const meals = get().meals.filter(meal => meal.id !== id);
    setItem(getScopedKey(KEYS.MEALS), meals);
    set({ meals });

    const userId = getLocalUserId();
    if (userId) void sendJson('/api/meal-logs', 'DELETE', { id, userId });
  },

  getMealsByDate: (date) => get().meals.filter(meal => meal.date === date),

  getDailySummary: (date) => sumMealMacros(get().meals.filter(meal => meal.date === date)),
}));
