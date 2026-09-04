import type { DailyReport, WeeklyReport } from '@/lib/types';
import { getScopedKey } from '@/lib/accounts';
import { getItem, KEYS, setItem } from '@/lib/storage';

const DAILY_CACHE_LIMIT = 30;
const WEEKLY_CACHE_LIMIT = 16;

// The daily-report store and the report-inbox store share these cache keys
// but fetch different list lengths (7 vs 14); replacing the cache wholesale
// let them evict each other's entries. Writes now merge by id, newest first.
export function writeDailyReportsCache(reports: DailyReport[]): DailyReport[] {
  const existing = getItem<DailyReport[]>(getScopedKey(KEYS.DAILY_REPORTS), []);
  const byId = new Map(existing.map(report => [report.id, report]));
  for (const report of reports) byId.set(report.id, report);
  const merged = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, DAILY_CACHE_LIMIT);
  setItem(getScopedKey(KEYS.DAILY_REPORTS), merged);
  return merged;
}

export function writeWeeklyReportsCache(reports: WeeklyReport[]): WeeklyReport[] {
  const existing = getItem<WeeklyReport[]>(getScopedKey(KEYS.WEEKLY_REPORTS), []);
  const byId = new Map(existing.map(report => [report.id, report]));
  for (const report of reports) byId.set(report.id, report);
  const merged = [...byId.values()].sort((a, b) => b.weekIndex - a.weekIndex).slice(0, WEEKLY_CACHE_LIMIT);
  setItem(getScopedKey(KEYS.WEEKLY_REPORTS), merged);
  return merged;
}
