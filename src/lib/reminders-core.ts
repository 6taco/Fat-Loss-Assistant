// Pure reminder decision logic — no imports so it stays loadable by the
// Node test runner (which cannot resolve extensionless TS value imports).

export type ReminderKind = 'weight' | 'evening';

export interface ReminderSlot {
  enabled: boolean;
  time: string; // 'HH:MM' local time
}

export interface ReminderSettings {
  enabled: boolean;
  weight: ReminderSlot;
  evening: ReminderSlot;
  // 'YYYY-MM-DD' stamps: a slot fires (or is skipped as done) at most once a day
  lastFired: Partial<Record<ReminderKind, string>>;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  weight: { enabled: true, time: '07:30' },
  evening: { enabled: true, time: '21:00' },
  lastFired: {},
};

export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(part => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return -1;
  }
  return hours * 60 + minutes;
}

export interface ReminderInputs {
  today: string;      // YYYY-MM-DD (local)
  nowMinutes: number; // minutes since local midnight
  hasWeightToday: boolean;
  planCompleted: boolean;
  mealsLogged: boolean;
}

export interface PlannedReminder {
  kind: ReminderKind;
  title: string;
  body: string;
  tag: string;
}

// Pure decision: which reminders are due right now. Slots that reached their
// time get stamped for today either way — completed tasks never nag, and a
// fired slot never repeats within the same day.
export function evaluateReminders(settings: ReminderSettings, inputs: ReminderInputs): {
  fire: PlannedReminder[];
  stamp: Partial<Record<ReminderKind, string>>;
} {
  const fire: PlannedReminder[] = [];
  const stamp: Partial<Record<ReminderKind, string>> = {};
  if (!settings.enabled) return { fire, stamp };

  const { today } = inputs;

  if (settings.weight.enabled
    && settings.lastFired.weight !== today
    && isDue(settings.weight.time, inputs.nowMinutes)) {
    stamp.weight = today;
    if (!inputs.hasWeightToday) {
      fire.push({
        kind: 'weight',
        title: '该称重啦',
        body: '记录今天的体重，让趋势和预测更准确。早起空腹称最稳定。',
        tag: `fla-reminder-weight-${today}`,
      });
    }
  }

  if (settings.evening.enabled
    && settings.lastFired.evening !== today
    && isDue(settings.evening.time, inputs.nowMinutes)) {
    stamp.evening = today;
    const pending: string[] = [];
    if (!inputs.mealsLogged) pending.push('饮食还没记录');
    if (!inputs.planCompleted) pending.push('今天还没打卡');
    if (pending.length) {
      fire.push({
        kind: 'evening',
        title: '晚间收尾提醒',
        body: `${pending.join('，')}。花一分钟收个尾，明天的建议会更准。`,
        tag: `fla-reminder-evening-${today}`,
      });
    }
  }

  return { fire, stamp };
}

function isDue(time: string, nowMinutes: number): boolean {
  const at = parseTimeToMinutes(time);
  return at >= 0 && nowMinutes >= at;
}
