import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IMPORT_DATASETS,
  validateImportChunk,
  sanitizeImportItem,
} from './account-import.js';

test('accepts a supported import dataset with no more than 100 items', () => {
  const result = validateImportChunk('weights', [
    { sourceId: 'weight-1', date: '2026-08-20', weight: 72.4 },
  ]);

  assert.equal(result.ok, true);
  assert.equal(IMPORT_DATASETS.includes('weights'), true);
});

test('rejects unsupported datasets and oversized chunks', () => {
  assert.equal(validateImportChunk('sessions', []).ok, false);
  assert.equal(validateImportChunk('weights', Array.from({ length: 101 }, (_, index) => ({ sourceId: String(index) }))).ok, false);
});

test('removes client supplied ownership fields from imported records', () => {
  const result = sanitizeImportItem({
    sourceId: 'meal-1',
    userId: 'forged-user',
    authUserId: 'forged-auth-user',
    ownerId: 'forged-owner',
    description: '午餐',
  });

  assert.deepEqual(result, { sourceId: 'meal-1', description: '午餐' });
});

test('rejects invalid dates and out-of-range body values', () => {
  assert.equal(validateImportChunk('weights', [{ sourceId: 'w1', date: 'not-a-date', weight: 72 }]).ok, false);
  assert.equal(validateImportChunk('weights', [{ sourceId: 'w2', date: '2026-08-20', weight: 500 }]).ok, false);
  assert.equal(validateImportChunk('user', [{ sourceId: 'u1', gender: 'male', age: 8, height: 175, weight: 72, bodyFat: 20 }]).ok, false);
});
