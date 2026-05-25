import { create } from 'zustand';
import { getJson } from '@/lib/client-api';
import { buildWeightPrediction } from '@/lib/weight-prediction-core';
import { DayPlan, MealLog, UserProfile, WeightEntry, WeightPredictionResult } from '@/lib/mock-data';
import { getActiveAccount, getScopedKey } from '@/lib/accounts';
import { getItem, KEYS, setItem } from '@/lib/storage';

interface WeightPredictionState {
  predictions: WeightPredictionResult[];
  latestPrediction: WeightPredictionResult | null;
  isLoading: boolean;
  error: string;
  loadPredictions: () => void;
  generatePrediction: () => Promise<WeightPredictionResult | null>;
}

function getLocalUserId() {
  const account = getActiveAccount();
  if (!account) return null;
  return getItem<UserProfile | null>(getScopedKey(KEYS.USER), null)?.id || account.id;
}

function sortPredictions(predictions: WeightPredictionResult[]) {
  return [...predictions].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

function savePredictions(predictions: WeightPredictionResult[]) {
  const sorted = sortPredictions(predictions);
  setItem(getScopedKey(KEYS.WEIGHT_PREDICTIONS), sorted);
  return sorted;
}

export const useWeightPredictionStore = create<WeightPredictionState>((set, get) => ({
  predictions: [],
  latestPrediction: null,
  isLoading: false,
  error: '',

  loadPredictions: () => {
    const local = sortPredictions(getItem<WeightPredictionResult[]>(getScopedKey(KEYS.WEIGHT_PREDICTIONS), []));
    set({ predictions: local, latestPrediction: local[0] || null, error: '' });

    const userId = getLocalUserId();
    if (!userId) return;

    set({ isLoading: true });
    void getJson<{ predictions: WeightPredictionResult[] }>(`/api/weight-predictions?userId=${encodeURIComponent(userId)}&latest=false&limit=10`).then((data) => {
      if (data?.predictions) {
        const predictions = savePredictions(data.predictions);
        set({ predictions, latestPrediction: predictions[0] || null });
      }
      set({ isLoading: false });
    });
  },

  generatePrediction: async () => {
    const userId = getLocalUserId();
    if (!userId) return null;

    set({ isLoading: true, error: '' });
    try {
      const response = await fetch('/api/weight-predictions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, horizonDays: 30 }),
      });
      const data = await response.json() as { prediction?: WeightPredictionResult | null; source?: string };
      const prediction = data.prediction || buildLocalPrediction(userId);

      if (!prediction) {
        set({ isLoading: false, error: '至少需要 3 条体重记录才能生成预测。' });
        return null;
      }

      const predictions = savePredictions([prediction, ...get().predictions.filter(item => item.id !== prediction.id)]);
      set({ predictions, latestPrediction: predictions[0] || null, isLoading: false });
      return prediction;
    } catch {
      const prediction = buildLocalPrediction(userId);
      if (!prediction) {
        set({ isLoading: false, error: '至少需要 3 条体重记录才能生成预测。' });
        return null;
      }
      const predictions = savePredictions([prediction, ...get().predictions.filter(item => item.id !== prediction.id)]);
      set({ predictions, latestPrediction: predictions[0] || null, isLoading: false });
      return prediction;
    }
  },
}));

function buildLocalPrediction(userId: string): WeightPredictionResult | null {
  const user = getItem<UserProfile | null>(getScopedKey(KEYS.USER), null);
  if (!user) return null;

  const weights = getItem<WeightEntry[]>(getScopedKey(KEYS.WEIGHT), []);
  const plans = getItem<DayPlan[]>(getScopedKey(KEYS.PLAN), []);
  const meals = getItem<MealLog[]>(getScopedKey(KEYS.MEALS), []);
  const prediction = buildWeightPrediction({
    userId,
    currentWeight: weights[weights.length - 1]?.weight ?? user.weight,
    goalWeight: user.goalWeight,
    weightEntries: mergeInitialWeight(user, weights),
    plans,
    meals,
    horizonDays: 30,
  });

  return {
    ...prediction,
    id: `local-weight-prediction-${userId}-${Date.now()}`,
  };
}

function mergeInitialWeight(user: UserProfile, entries: WeightEntry[]): WeightEntry[] {
  const byDate = new Map<string, WeightEntry>();
  for (const entry of entries) byDate.set(entry.date, entry);
  byDate.set(user.initialWeightDate || user.startDate, {
    date: user.initialWeightDate || user.startDate,
    weight: user.weight,
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
