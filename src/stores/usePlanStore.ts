import { create } from 'zustand';
import { getJson, sendJson } from '@/lib/client-api';
import { DayPlan, UserProfile, mockPlan } from '@/lib/mock-data';
import { getItem, setItem, KEYS } from '@/lib/storage';

interface PlanState {
  plans: DayPlan[];
  activePlan: boolean;
  loadPlans: () => void;
  setPlans: (plans: DayPlan[]) => void;
  toggleComplete: (date: string) => void;
}

function getLocalUserId() {
  return getItem<UserProfile | null>(KEYS.USER, null)?.id;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  activePlan: false,

  loadPlans: () => {
    const plans = getItem<DayPlan[]>(KEYS.PLAN, mockPlan);
    set({ plans, activePlan: plans.length > 0 });

    const userId = getLocalUserId();
    if (!userId) return;

    void getJson<{ plans: DayPlan[] }>(`/api/day-plans?userId=${encodeURIComponent(userId)}`).then((data) => {
      if (!data?.plans?.length) return;
      setItem(KEYS.PLAN, data.plans);
      set({ plans: data.plans, activePlan: true });
    });
  },

  setPlans: (plans) => {
    setItem(KEYS.PLAN, plans);
    set({ plans, activePlan: true });

    const userId = getLocalUserId();
    if (userId) void sendJson('/api/day-plans', 'POST', { userId, plans });
  },

  toggleComplete: (date) => {
    const plans = get().plans.map(p =>
      p.date === date ? { ...p, completed: !p.completed } : p,
    );
    const updated = plans.find(plan => plan.date === date);
    setItem(KEYS.PLAN, plans);
    set({ plans });

    const userId = getLocalUserId();
    if (userId && updated) {
      void sendJson('/api/day-plans', 'PATCH', {
        userId,
        date,
        completed: updated.completed,
      });
    }
  },
}));
