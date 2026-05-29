import assert from 'node:assert/strict';
import test from 'node:test';

import { groupMealsByType } from './meal-groups.js';

const baseMeal = {
  date: '2026-05-29',
  items: [],
  source: 'manual',
};

test('groups same-day meals by meal type and keeps individual entries', () => {
  const groups = groupMealsByType([
    {
      ...baseMeal,
      id: 'breakfast-2',
      mealType: 'breakfast',
      description: 'later yogurt',
      carb: 10,
      protein: 8,
      fat: 3,
      calories: 99,
      createdAt: '2026-05-29T08:30:00.000Z',
    },
    {
      ...baseMeal,
      id: 'lunch-1',
      mealType: 'lunch',
      description: 'chicken rice',
      carb: 60,
      protein: 35,
      fat: 12,
      calories: 488,
      createdAt: '2026-05-29T12:00:00.000Z',
    },
    {
      ...baseMeal,
      id: 'breakfast-1',
      mealType: 'breakfast',
      description: 'eggs and toast',
      carb: 24,
      protein: 18,
      fat: 11,
      calories: 267,
      createdAt: '2026-05-29T07:30:00.000Z',
    },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].mealType, 'breakfast');
  assert.equal(groups[0].meals.length, 2);
  assert.deepEqual(groups[0].meals.map(meal => meal.id), ['breakfast-1', 'breakfast-2']);
  assert.deepEqual(groups[0].summary, {
    carb: 34,
    protein: 26,
    fat: 14,
    calories: 366,
  });
  assert.equal(groups[1].mealType, 'lunch');
});
