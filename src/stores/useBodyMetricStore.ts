import { create } from 'zustand';
import { track } from '@/lib/analytics/client';
import { getJson, sendJson } from '@/lib/client-api';
import { BodyMetricEntry, UserProfile } from '@/lib/types';
import { getItem, KEYS, setItem } from '@/lib/storage';
import { getScopedKey } from '@/lib/accounts';
import { isFreshData } from '@/lib/staleness';

interface BodyMetricState {
  entries: BodyMetricEntry[];
  lastFetchedAt: number;
  loadEntries: () => void;
  saveEntry: (entry: Omit<BodyMetricEntry, 'id'>) => void;
}

function getLocalUserId() {
  return getItem<UserProfile | null>(getScopedKey(KEYS.USER), null)?.id;
}

function sortEntries(entries: BodyMetricEntry[]) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

export const useBodyMetricStore = create<BodyMetricState>((set, get) => ({
  entries: [],
  lastFetchedAt: 0,

  loadEntries: () => {
    if (isFreshData(get().lastFetchedAt)) return;
    const entries = sortEntries(getItem<BodyMetricEntry[]>(getScopedKey(KEYS.BODY_METRICS), []));
    set({ entries });

    const userId = getLocalUserId();
    if (!userId) return;

    void getJson<{ entries: BodyMetricEntry[] }>(`/api/body-metrics?userId=${encodeURIComponent(userId)}`).then((data) => {
      if (!data?.entries?.length) return;
      const sorted = sortEntries(data.entries);
      setItem(getScopedKey(KEYS.BODY_METRICS), sorted);
      set({ entries: sorted, lastFetchedAt: Date.now() });
    });
  },

  saveEntry: (entry) => {
    const id = `body-${entry.date}`;
    const entries = sortEntries([
      ...get().entries.filter(item => item.id !== id),
      { ...entry, id },
    ]);
    setItem(getScopedKey(KEYS.BODY_METRICS), entries);
    set({ entries, lastFetchedAt: Date.now() });

    const userId = getLocalUserId();
    track('body_metric_create', { date: entry.date }, { userId });
    if (userId) {
      void sendJson('/api/body-metrics', 'POST', { ...entry, userId }).catch((error) => {
        console.error('Failed to save body metric to server:', error);
      });
    }
  },
}));
