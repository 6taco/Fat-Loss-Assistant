import { create } from 'zustand';
import { getJson, sendJson } from '@/lib/client-api';
import { UserProfile } from '@/lib/mock-data';
import { getItem, setItem, KEYS } from '@/lib/storage';
import { getActiveAccount, getScopedKey } from '@/lib/accounts';

interface UserState {
  user: UserProfile | null;
  isOnboarded: boolean;
  setUser: (user: UserProfile) => Promise<void>;
  loadUser: () => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isOnboarded: false,

  setUser: async (user) => {
    setItem(getScopedKey(KEYS.USER), user);
    set({ user, isOnboarded: true });
    await sendJson<{ user: UserProfile }>('/api/users', 'POST', user);
  },

  loadUser: () => {
    const account = getActiveAccount();
    if (!account) {
      set({ user: null, isOnboarded: false });
      return;
    }

    const localUser = getItem<UserProfile | null>(getScopedKey(KEYS.USER), null);
    set({ user: localUser, isOnboarded: !!localUser });

    if (!localUser?.id) return;

    void getJson<{ user: UserProfile }>(`/api/users?id=${encodeURIComponent(localUser.id)}`).then((data) => {
      if (!data?.user) return;
      setItem(getScopedKey(KEYS.USER), data.user);
      set({ user: data.user, isOnboarded: true });
    });
  },

  clearUser: () => {
    set({ user: null, isOnboarded: false });
  },
}));
