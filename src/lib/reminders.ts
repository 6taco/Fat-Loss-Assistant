import { getItem, setItem, KEYS } from './storage';
import { getLocalDateIso } from './date-utils';
import {
  DEFAULT_REMINDER_SETTINGS,
  evaluateReminders,
  type PlannedReminder,
  type ReminderInputs,
  type ReminderSettings,
} from './reminders-core';

export {
  DEFAULT_REMINDER_SETTINGS,
  evaluateReminders,
  parseTimeToMinutes,
  type PlannedReminder,
  type ReminderInputs,
  type ReminderKind,
  type ReminderSettings,
  type ReminderSlot,
} from './reminders-core';

export function loadReminderSettings(): ReminderSettings {
  const stored = getItem<Partial<ReminderSettings>>(KEYS.REMINDERS, {});
  return {
    ...DEFAULT_REMINDER_SETTINGS,
    ...stored,
    weight: { ...DEFAULT_REMINDER_SETTINGS.weight, ...stored.weight },
    evening: { ...DEFAULT_REMINDER_SETTINGS.evening, ...stored.evening },
    lastFired: stored.lastFired || {},
  };
}

export function saveReminderSettings(settings: ReminderSettings): void {
  setItem(KEYS.REMINDERS, settings);
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (notificationPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showReminderNotification(planned: PlannedReminder): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false;
  const options: NotificationOptions = {
    body: planned.body,
    tag: planned.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  };
  try {
    // Prefer the service worker so the click handler and icon work on mobile.
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(planned.title, options);
    } else {
      new Notification(planned.title, options);
    }
    return true;
  } catch {
    return false;
  }
}

// Scheduler entry: decide against current state, persist today's stamps, and
// hand the notifications to the caller (UI owns side effects).
export function collectReminderActions(
  inputs: Omit<ReminderInputs, 'today' | 'nowMinutes'>,
  now: Date = new Date(),
): { fire: PlannedReminder[] } {
  const settings = loadReminderSettings();
  const result = evaluateReminders(settings, {
    ...inputs,
    today: getLocalDateIso(now),
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
  });
  if (result.stamp.weight || result.stamp.evening) {
    saveReminderSettings({ ...settings, lastFired: { ...settings.lastFired, ...result.stamp } });
  }
  return { fire: result.fire };
}
