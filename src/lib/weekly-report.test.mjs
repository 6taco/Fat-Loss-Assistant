import assert from 'node:assert/strict';
import test from 'node:test';

import { getPreviousClosedWeekIndex } from './weekly-report-schedule.ts';

test('closes the first user week at Beijing Monday 00:20 even though UTC is still Sunday', () => {
  const now = new Date('2026-08-02T16:20:00.000Z');

  assert.equal(getPreviousClosedWeekIndex('2026-07-27', now), 1);
});

test('closes a personal seven-day cycle on its own weekly anniversary', () => {
  const now = new Date('2026-08-05T16:20:00.000Z');

  assert.equal(getPreviousClosedWeekIndex('2026-07-30', now), 1);
});

test('does not close a weekly cycle before the final Beijing calendar day ends', () => {
  const now = new Date('2026-08-05T15:59:00.000Z');

  assert.equal(getPreviousClosedWeekIndex('2026-07-30', now), null);
});
