import { KEYS, getItem, removeItem } from '@/lib/storage';
import { ChatMessage, DayPlan, MealLog, UserProfile, WeightEntry } from '@/lib/mock-data';

export interface LocalAppData {
  exportedAt: string;
  user: UserProfile | null;
  plans: DayPlan[];
  weightEntries: WeightEntry[];
  mealLogs: MealLog[];
  chatMessages: ChatMessage[];
}

export function readLocalAppData(): LocalAppData {
  return {
    exportedAt: new Date().toISOString(),
    user: getItem<UserProfile | null>(KEYS.USER, null),
    plans: getItem<DayPlan[]>(KEYS.PLAN, []),
    weightEntries: getItem<WeightEntry[]>(KEYS.WEIGHT, []),
    mealLogs: getItem<MealLog[]>(KEYS.MEALS, []),
    chatMessages: getItem<ChatMessage[]>(KEYS.CHAT, []),
  };
}

export function clearLocalAppData() {
  Object.values(KEYS).forEach(removeItem);
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
