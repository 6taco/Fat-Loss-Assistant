const isBrowser = typeof window !== 'undefined';

function notifyStorageError(message: string) {
  if (!isBrowser) return;
  window.dispatchEvent(new CustomEvent('app-toast', {
    detail: { message, type: 'error' },
  }));
}

export function getItem<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    notifyStorageError('本地数据读取失败，已使用默认数据。');
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    notifyStorageError('保存失败，请检查浏览器存储权限或剩余空间。');
  }
}

export function removeItem(key: string): void {
  if (!isBrowser) return;
  try {
    localStorage.removeItem(key);
  } catch {
    notifyStorageError('清除本地数据失败，请稍后重试。');
  }
}

// Storage keys
export const KEYS = {
  USER: 'fla_user',
  PLAN: 'fla_plan',
  CHAT: 'fla_chat',
  WEIGHT: 'fla_weight',
  MEALS: 'fla_meals',
  DAILY_REPORTS: 'fla_daily_reports',
  WEEKLY_REPORTS: 'fla_weekly_reports',
  WEIGHT_PREDICTIONS: 'fla_weight_predictions',
  ANONYMOUS_ID: 'fla_anonymous_user_id',
  ONBOARDING: 'fla_onboarding',
  ACCOUNTS: 'fla_accounts',
  ACTIVE_ACCOUNT_ID: 'fla_active_account_id',
} as const;
