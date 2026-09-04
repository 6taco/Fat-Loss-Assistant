import { create } from 'zustand';
import { getJson, sendJson } from '@/lib/client-api';
import { UserProfile } from '@/lib/types';
import { getItem, setItem, KEYS } from '@/lib/storage';
import { getScopedKey } from '@/lib/accounts';
import { isFreshData } from '@/lib/staleness';

interface UserState {
  user: UserProfile | null;
  isOnboarded: boolean;
  lastFetchedAt: number;
  setUser: (user: UserProfile) => Promise<UserProfile | null>;
  loadUser: () => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isOnboarded: false,
  lastFetchedAt: 0,

  setUser: async (user) => {
    const saved = await sendJson<{ user: UserProfile }>('/api/users', 'POST', user);
    if (!saved?.user) return null;
    setItem(getScopedKey(KEYS.USER), saved.user);
    set({ user: saved.user, isOnboarded: true, lastFetchedAt: Date.now() });
    return saved.user;
  },

  loadUser: () => {
    if (isFreshData(useUserStore.getState().lastFetchedAt)) return;
    const localUser = getItem<UserProfile | null>(getScopedKey(KEYS.USER), null);
    set({ user: localUser, isOnboarded: !!localUser });

    void getJson<{ user: UserProfile }>('/api/users').then((data) => {
      if (!data?.user) return;
      setItem(getScopedKey(KEYS.USER), data.user);
      set({ user: data.user, isOnboarded: true, lastFetchedAt: Date.now() });
    });
  },

  clearUser: () => {
    set({ user: null, isOnboarded: false, lastFetchedAt: 0 });
  },
}));
