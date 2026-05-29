import { create } from 'zustand';
import { track } from '@/lib/analytics/client';
import { getJson, sendJson } from '@/lib/client-api';
import { DayPlan, UserProfile } from '@/lib/mock-data';
import { getItem, setItem, KEYS } from '@/lib/storage';
import { getScopedKey } from '@/lib/accounts';

interface PlanState {
  plans: DayPlan[];
  activePlan: boolean;
  loadPlans: () => void;
  setPlans: (plans: DayPlan[], planType?: string) => void;
  toggleComplete: (date: string) => void;
}

function getLocalUserId() {
  return getItem<UserProfile | null>(getScopedKey(KEYS.USER), null)?.id;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: [],
  activePlan: false,

  loadPlans: () => {
    const plans = getItem<DayPlan[]>(getScopedKey(KEYS.PLAN), []);
    set({ plans, activePlan: plans.length > 0 });

    const userId = getLocalUserId();
    if (!userId) return;

    void getJson<{ plans: DayPlan[] }>(`/api/day-plans?userId=${encodeURIComponent(userId)}`).then((data) => {
      if (!data?.plans?.length) return;
      setItem(getScopedKey(KEYS.PLAN), data.plans);
      set({ plans: data.plans, activePlan: true });
    });
  },

  setPlans: (plans, planType) => {
    setItem(getScopedKey(KEYS.PLAN), plans);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('strategy-cache-change'));
    set({ plans, activePlan: true });

    const userId = getLocalUserId();
    track('plan_generate', {
      plan_type: planType || plans[0]?.strategyType || 'carb_cycle',
      calorie_target: plans[0]?.calories,
      days: plans.length,
    }, { userId });
    if (userId) void sendJson('/api/day-plans', 'POST', { userId, plans });
  },

  toggleComplete: (date) => {
    const plans = get().plans.map(p =>
      p.date === date ? { ...p, completed: !p.completed } : p,
    );
    const updated = plans.find(plan => plan.date === date);
    setItem(getScopedKey(KEYS.PLAN), plans);
    set({ plans });

    const userId = getLocalUserId();
    if (updated?.completed) {
      track('plan_complete', {
        date,
        carb_type: updated.carbType,
        calories: updated.calories,
      }, { userId });
    }
    if (userId && updated) {
      void sendJson('/api/day-plans', 'PATCH', {
        userId,
        date,
        completed: updated.completed,
      });
    }
  },
}));
