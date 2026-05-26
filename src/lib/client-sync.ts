import { sendJson } from '@/lib/client-api';
import type { DayPlan, MealLog, UserProfile, WeightEntry } from '@/lib/mock-data';
import { getScopedKey } from '@/lib/accounts';
import { getItem, KEYS } from '@/lib/storage';

export async function syncLocalDataToServer() {
  const user = getItem<UserProfile | null>(getScopedKey(KEYS.USER), null);
  if (!user?.id) return { userId: null, synced: false };

  await sendJson('/api/users', 'POST', user);

  const plans = getItem<DayPlan[]>(getScopedKey(KEYS.PLAN), []);
  if (plans.length) {
    await sendJson('/api/day-plans', 'POST', { userId: user.id, plans });
  }

  const weights = getItem<WeightEntry[]>(getScopedKey(KEYS.WEIGHT), []);
  for (const entry of weights) {
    await sendJson('/api/weight-entries', 'POST', { ...entry, userId: user.id });
  }

  const meals = getItem<MealLog[]>(getScopedKey(KEYS.MEALS), []);
  for (const meal of meals) {
    await sendJson('/api/meal-logs', 'POST', { ...meal, userId: user.id });
  }

  return { userId: user.id, synced: true };
}
