import { create } from 'zustand';
import { getJson, sendJson } from '@/lib/client-api';
import { UserProfile, mockUser } from '@/lib/mock-data';
import { getItem, setItem, KEYS } from '@/lib/storage';

interface UserState {
  user: UserProfile | null;
  isOnboarded: boolean;
  setUser: (user: UserProfile) => void;
  loadUser: () => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isOnboarded: false,

  setUser: (user) => {
    setItem(KEYS.USER, user);
    set({ user, isOnboarded: true });
    void sendJson<{ user: UserProfile }>('/api/users', 'POST', user);
  },

  loadUser: () => {
    const localUser = getItem<UserProfile | null>(KEYS.USER, null);
    set({ user: localUser || mockUser, isOnboarded: !!localUser });

    if (!localUser?.id) return;

    void getJson<{ user: UserProfile }>(`/api/users?id=${encodeURIComponent(localUser.id)}`).then((data) => {
      if (!data?.user) return;
      setItem(KEYS.USER, data.user);
      set({ user: data.user, isOnboarded: true });
    });
  },

  clearUser: () => {
    set({ user: null, isOnboarded: false });
  },
}));
