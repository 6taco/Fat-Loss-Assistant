import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTrainingCycleByFrequency,
  getTrainingDayForDateOffset,
  muscleGroupLabels,
} from './mock-data.ts';

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
