import { create } from 'zustand';
import { getJson, sendJson } from '@/lib/client-api';
import { UserProfile, WeightEntry } from '@/lib/mock-data';
import { getItem, setItem, KEYS } from '@/lib/storage';
import { getScopedKey } from '@/lib/accounts';

interface WeightState {
  entries: WeightEntry[];
  loadEntries: () => void;
  addEntry: (entry: WeightEntry) => void;
}

function getLocalUserId() {
  return getItem<UserProfile | null>(getScopedKey(KEYS.USER), null)?.id;
}

function sortEntries(entries: WeightEntry[]) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

export const useWeightStore = create<WeightState>((set, get) => ({
  entries: [],

  loadEntries: () => {
    const entries = sortEntries(getItem<WeightEntry[]>(getScopedKey(KEYS.WEIGHT), []));
    set({ entries });

    const userId = getLocalUserId();
    if (!userId) return;

    void getJson<{ entries: WeightEntry[] }>(`/api/weight-entries?userId=${encodeURIComponent(userId)}`).then((data) => {
      if (!data?.entries?.length) return;
      const sorted = sortEntries(data.entries);
      setItem(getScopedKey(KEYS.WEIGHT), sorted);
      set({ entries: sorted });
    });
  },

  addEntry: (entry) => {
    const current = get().entries;
    const existing = current.findIndex(e => e.date === entry.date);
    const updated = sortEntries(existing >= 0
      ? current.map((e, i) => i === existing ? entry : e)
      : [...current, entry]);
    setItem(getScopedKey(KEYS.WEIGHT), updated);
    set({ entries: updated });

    const userId = getLocalUserId();
    if (userId) void sendJson('/api/weight-entries', 'POST', { ...entry, userId });
  },
}));
