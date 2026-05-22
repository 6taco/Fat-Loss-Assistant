import { KEYS, getItem, removeItem } from '@/lib/storage';
import { ChatMessage, DayPlan, MealLog, UserProfile, WeightEntry } from '@/lib/mock-data';
import { getActiveAccount, getScopedKey } from '@/lib/accounts';

export interface LocalAppData {
  exportedAt: string;
  account: ReturnType<typeof getActiveAccount>;
  user: UserProfile | null;
  plans: DayPlan[];
  weightEntries: WeightEntry[];
  mealLogs: MealLog[];
  chatMessages: ChatMessage[];
}

export function readLocalAppData(): LocalAppData {
  return {
    exportedAt: new Date().toISOString(),
    account: getActiveAccount(),
    user: getItem<UserProfile | null>(getScopedKey(KEYS.USER), null),
    plans: getItem<DayPlan[]>(getScopedKey(KEYS.PLAN), []),
    weightEntries: getItem<WeightEntry[]>(getScopedKey(KEYS.WEIGHT), []),
    mealLogs: getItem<MealLog[]>(getScopedKey(KEYS.MEALS), []),
    chatMessages: getItem<ChatMessage[]>(getScopedKey(KEYS.CHAT), []),
  };
}

export function clearLocalAppData() {
  [KEYS.USER, KEYS.PLAN, KEYS.WEIGHT, KEYS.MEALS, KEYS.CHAT, KEYS.ONBOARDING].forEach(key => {
    removeItem(getScopedKey(key));
  });
}

export function downloadLocalAppData() {
  if (typeof window === 'undefined') return;

  const data = readLocalAppData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `fat-loss-assistant-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
