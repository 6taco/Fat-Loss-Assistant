import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_REMINDER_SETTINGS,
  evaluateReminders,
  parseTimeToMinutes,
} from './reminders-core.ts';

function baseInputs(overrides = {}) {
  return {
    today: '2026-09-04',
    nowMinutes: 12 * 60, // 12:00
    hasWeightToday: false,
    planCompleted: false,
    mealsLogged: false,
    ...overrides,
  };
}

function enabledSettings(overrides = {}) {
  return {
    ...DEFAULT_REMINDER_SETTINGS,
    enabled: true,
    ...overrides,
  };
}

test('parseTimeToMinutes handles valid and invalid inputs', () => {
  assert.equal(parseTimeToMinutes('07:30'), 450);
  assert.equal(parseTimeToMinutes('21:00'), 1260);
  assert.equal(parseTimeToMinutes('00:00'), 0);
  assert.equal(parseTimeToMinutes('24:00'), -1);
  assert.equal(parseTimeToMinutes('ab:cd'), -1);
  assert.equal(parseTimeToMinutes(''), -1);
});

test('does nothing when reminders are disabled', () => {
  const result = evaluateReminders({ ...DEFAULT_REMINDER_SETTINGS, enabled: false }, baseInputs());
  assert.equal(result.fire.length, 0);
  assert.equal(Object.keys(result.stamp).length, 0);
});

test('fires the weight reminder after its time when no weight is logged', () => {
  const result = evaluateReminders(enabledSettings(), baseInputs());
  const kinds = result.fire.map(item => item.kind);
  assert.ok(kinds.includes('weight'));
  assert.equal(result.stamp.weight, '2026-09-04');
});

test('skips (but stamps) the weight reminder when the task is already done', () => {
  const result = evaluateReminders(enabledSettings(), baseInputs({ hasWeightToday: true }));
  assert.ok(!result.fire.some(item => item.kind === 'weight'));
  assert.equal(result.stamp.weight, '2026-09-04');
});

test('does not fire before the configured time', () => {
  const result = evaluateReminders(
    enabledSettings({ weight: { enabled: true, time: '13:00' } }),
    baseInputs({ nowMinutes: 12 * 60 }),
  );
  assert.ok(!result.fire.some(item => item.kind === 'weight'));
  assert.equal(result.stamp.weight, undefined);
});

test('treats an invalid time as never due', () => {
  const result = evaluateReminders(
    enabledSettings({ weight: { enabled: true, time: 'broken' } }),
    baseInputs(),
  );
  assert.ok(!result.fire.some(item => item.kind === 'weight'));
  assert.equal(result.stamp.weight, undefined);
});

test('evening reminder lists only pending tasks', () => {
  // 22:00 — past the default 21:00 evening slot.
  const result = evaluateReminders(enabledSettings(), baseInputs({ nowMinutes: 22 * 60, mealsLogged: true }));
  const evening = result.fire.find(item => item.kind === 'evening');
  assert.ok(evening);
  assert.ok(!evening.body.includes('饮食'));
  assert.ok(evening.body.includes('打卡'));
});

test('evening reminder is skipped silently when everything is done', () => {
  const result = evaluateReminders(
    enabledSettings(),
    baseInputs({ nowMinutes: 22 * 60, mealsLogged: true, planCompleted: true }),
  );
  assert.ok(!result.fire.some(item => item.kind === 'evening'));
  assert.equal(result.stamp.evening, '2026-09-04');
});

test('already fired today means no repeat', () => {
  const result = evaluateReminders(
    enabledSettings({ lastFired: { weight: '2026-09-04', evening: '2026-09-04' } }),
    baseInputs(),
  );
  assert.equal(result.fire.length, 0);
  assert.equal(Object.keys(result.stamp).length, 0);
});

test('fires again on a new day', () => {
  const result = evaluateReminders(
    enabledSettings({ lastFired: { weight: '2026-09-03' } }),
    baseInputs(),
  );
  assert.ok(result.fire.some(item => item.kind === 'weight'));
  assert.equal(result.stamp.weight, '2026-09-04');
});
