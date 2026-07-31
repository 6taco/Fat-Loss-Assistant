import { create } from 'zustand';
import { getScopedKey } from '@/lib/accounts';
import { getItem, KEYS, setItem } from '@/lib/storage';

export type CoachGender = 'male' | 'female';

export interface CoachProfile {
  gender: CoachGender;
  name: string;
  displayName: string;
  avatar: string;
  description: string;
}

export const COACH_PROFILES: Record<CoachGender, CoachProfile> = {
  male: {
    gender: 'male',
    name: '意',
    displayName: '教练意',
    avatar: '/images/coach-yi.png',
    description: '沉稳专业，陪你把计划一步步落实',
  },
  female: {
    gender: 'female',
    name: '睿',
    displayName: '教练睿',
    avatar: '/images/coach-rui.png',
    description: '温柔细致，陪你找到可持续的节奏',
  },
};

interface CoachPreferenceState {
  gender: CoachGender;
  loadPreference: () => void;
  setGender: (gender: CoachGender) => void;
}

export const useCoachPreferenceStore = create<CoachPreferenceState>((set) => ({
  gender: 'male',

  loadPreference: () => {
    const gender = getItem<CoachGender>(getScopedKey(KEYS.COACH_PREFERENCE), 'male');
    set({ gender: gender === 'female' ? 'female' : 'male' });
  },

  setGender: (gender) => {
    setItem(getScopedKey(KEYS.COACH_PREFERENCE), gender);
    set({ gender });
  },
}));
