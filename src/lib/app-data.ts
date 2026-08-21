import { KEYS, getItem, removeItem } from '@/lib/storage';
import { ChatMessage, DayPlan, MealLog, UserProfile, WeightEntry } from '@/lib/mock-data';
import { getAccounts, getAccountScopedKey, getActiveAccount, getScopedKey } from '@/lib/accounts';

export interface LocalAppData {
  exportedAt: string;
  account: ReturnType<typeof getActiveAccount>;
  user: UserProfile | null;
  plans: DayPlan[];
  weightEntries: WeightEntry[];
  mealLogs: MealLog[];
  chatMessages: ChatMessage[];
  dailyReports?: unknown[];
  weeklyReports?: unknown[];
  lifestyleProfile?: unknown;
}

export function readLocalAppData(): LocalAppData {
  return readLocalAppDataForAccount(getActiveAccount()?.id || null);
}

export function readLocalAppDataForAccount(accountId: string | null): LocalAppData {
  const account = getAccounts().find(item => item.id === accountId) || null;
  const key = (baseKey: string) => getAccountScopedKey(accountId, baseKey);
  return {
    exportedAt: new Date().toISOString(),
    account,
    user: getItem<UserProfile | null>(key(KEYS.USER), null),
    plans: getItem<DayPlan[]>(key(KEYS.PLAN), []),
    weightEntries: getItem<WeightEntry[]>(key(KEYS.WEIGHT), []),
    mealLogs: getItem<MealLog[]>(key(KEYS.MEALS), []),
    chatMessages: getItem<ChatMessage[]>(key(KEYS.CHAT), []),
    dailyReports: getItem<unknown[]>(key(KEYS.DAILY_REPORTS), []),
    weeklyReports: getItem<unknown[]>(key(KEYS.WEEKLY_REPORTS), []),
    lifestyleProfile: getItem<unknown | null>(key(KEYS.LIFESTYLE_PROFILE), null) || undefined,
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
