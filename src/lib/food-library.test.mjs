import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHistoryFoods, matchLocalEstimate } from './food-library.ts';

test('matches a simple library meal with totals', () => {
  const result = matchLocalEstimate('米饭、鸡胸肉、西兰花', []);
  assert.ok(result);
  assert.equal(result.items.length, 3);
  assert.equal(result.items[0].name, '米饭');
  assert.equal(result.calories, 232 + 180 + 50);
  assert.ok(result.warnings.some(w => w.includes('本地食物库')));
});

test('matches via aliases and separators including 和/加', () => {
  const result = matchLocalEstimate('水煮蛋和全麦吐司 加 牛奶', []);
  assert.ok(result);
  assert.deepEqual(result.items.map(item => item.name), ['鸡蛋', '全麦面包', '牛奶']);
});

test('scales macros when the token carries explicit grams', () => {
  const result = matchLocalEstimate('鸡胸肉200g', []);
  assert.ok(result);
  const chicken = result.items[0];
  assert.equal(chicken.weightGram, 200);
  assert.equal(chicken.calories, 240); // 180 * (200/150)
  assert.equal(chicken.amountText, '200g');
});

test('returns null when any token is unrecognized', () => {
  assert.equal(matchLocalEstimate('米饭、麻辣香锅', []), null);
  assert.equal(matchLocalEstimate('罗汉果决明子菊花茶', []), null);
});

test('prefers the user history over the built-in library', () => {
  const history = buildHistoryFoods([
    { items: [{ name: '鸡胸肉', weightGram: 120, calories: 150, carb: 0, protein: 28, fat: 3 }] },
    { items: [{ name: '鸡胸肉', weightGram: 120, calories: 150, carb: 0, protein: 28, fat: 3 }] },
  ]);
  const result = matchLocalEstimate('鸡胸肉', history);
  assert.ok(result);
  assert.equal(result.items[0].weightGram, 120);
  assert.equal(result.items[0].calories, 150);
  assert.ok(result.warnings.some(w => w.includes('历史记录')));
});

test('buildHistoryFoods averages repeated items and sorts by frequency', () => {
  const history = buildHistoryFoods([
    { items: [
      { name: '燕麦', weightGram: 40, calories: 150, carb: 27, protein: 5, fat: 3 },
      { name: '燕麦', weightGram: 60, calories: 225, carb: 40, protein: 7, fat: 4 },
    ] },
    { items: [{ name: '鸡蛋', weightGram: 50, calories: 72, carb: 1, protein: 6, fat: 5 }] },
  ]);
  assert.equal(history[0].name, '燕麦');
  assert.equal(history[0].count, 2);
  assert.equal(history[0].weightGram, 50);
  assert.equal(history[0].calories, 188);
  assert.equal(history[1].name, '鸡蛋');
});

test('empty or whitespace-only descriptions never match', () => {
  assert.equal(matchLocalEstimate('', []), null);
  assert.equal(matchLocalEstimate('   ', []), null);
});
