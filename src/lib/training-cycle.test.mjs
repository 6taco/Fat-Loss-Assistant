import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendTrainingCycleDay,
  buildTrainingCycleByFrequency,
  getPlanWeek,
  getTrainingDayForDateOffset,
  muscleGroupLabels,
  removeLastTrainingCycleDay,
  updateTrainingCycleDay,
} from './mock-data.ts';

function makePlan(date) {
  return {
    date,
    carbType: 'mid',
    calories: 1800,
    carb: 200,
    protein: 100,
    fat: 60,
    completed: false,
  };
}

test('preserves manually configured rest days even when stale rhythm metadata remains', () => {
  const generatedCycle = buildTrainingCycleByFrequency(5);
  const requestedGroups = ['chest', 'back', 'rest', 'shoulders', 'legs', 'rest'];
  const customizedCycle = generatedCycle.slice(0, requestedGroups.length).map((day, dayIndex) => ({
    ...day,
    muscleGroup: requestedGroups[dayIndex],
    label: muscleGroupLabels[requestedGroups[dayIndex]],
  }));

  const generatedGroups = Array.from(
    { length: requestedGroups.length * 2 },
    (_, offset) => getTrainingDayForDateOffset(customizedCycle, offset).muscleGroup,
  );

  assert.deepEqual(generatedGroups, [...requestedGroups, ...requestedGroups]);
});

test('keeps frequency-generated rhythm behavior when the generated cycle is untouched', () => {
  const generatedCycle = buildTrainingCycleByFrequency(5);

  const generatedGroups = Array.from(
    { length: 8 },
    (_, offset) => getTrainingDayForDateOffset(generatedCycle, offset).muscleGroup,
  );

  assert.deepEqual(generatedGroups, [
    'chest',
    'back',
    'shoulders',
    'legs',
    'arms',
    'rest',
    'core',
    'chest',
  ]);
});

test('supports adding, editing, and removing custom cycle days', () => {
  const initialCycle = [
    { dayIndex: 0, muscleGroup: 'chest', label: '练胸' },
    { dayIndex: 1, muscleGroup: 'back', label: '练背' },
  ];
  const withRest = appendTrainingCycleDay(initialCycle);
  const edited = updateTrainingCycleDay(withRest, 2, 'rest');
  const shortened = removeLastTrainingCycleDay(edited);

  assert.deepEqual(edited.map(day => day.muscleGroup), ['chest', 'back', 'rest']);
  assert.deepEqual(shortened.map(day => day.muscleGroup), ['chest', 'back']);
  assert.equal(shortened.every(day => !day.cycleMode && !day.trainingStreak), true);
});

test('selects the current calendar week instead of always using the first seven plans', () => {
  const plans = Array.from({ length: 21 }, (_, index) => makePlan(`2026-07-${String(index + 1).padStart(2, '0')}`));
  const currentWeek = getPlanWeek(plans, '2026-07-10');

  assert.equal(currentWeek.weekNumber, 2);
  assert.deepEqual(currentWeek.plans.map(plan => plan.date), [
    '2026-07-08',
    '2026-07-09',
    '2026-07-10',
    '2026-07-11',
    '2026-07-12',
    '2026-07-13',
    '2026-07-14',
  ]);
});
