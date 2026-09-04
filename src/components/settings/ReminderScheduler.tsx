'use client';

import { useEffect } from 'react';
import { collectReminderActions, showReminderNotification } from '@/lib/reminders';
import { getTodayIso } from '@/lib/date-utils';
import { useWeightStore } from '@/stores/useWeightStore';
import { usePlanStore } from '@/stores/usePlanStore';
import { useMealStore } from '@/stores/useMealStore';

// Runs while the app is open (foreground or suspended with a live service
// worker): once a minute and on tab focus it checks whether an enabled
// reminder slot is due and fires it at most once per day.
export default function ReminderScheduler() {
  useEffect(() => {
    let running = false;

    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const today = getTodayIso();
        const { entries } = useWeightStore.getState();
        const { plans } = usePlanStore.getState();
        const { meals } = useMealStore.getState();

        const actions = collectReminderActions({
          hasWeightToday: entries.some(entry => entry.date === today),
          planCompleted: plans.some(plan => plan.date === today && plan.completed),
          mealsLogged: meals.some(meal => meal.date === today),
        });

        for (const planned of actions.fire) {
          await showReminderNotification(planned);
        }
      } finally {
        running = false;
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
