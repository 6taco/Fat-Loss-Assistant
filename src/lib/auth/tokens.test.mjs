import assert from 'node:assert/strict';
import test from 'node:test';

import { createRawToken, hashToken } from './tokens.js';

test('creates URL-safe random tokens', () => {
  const token = createRawToken();

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
});

test('hashes the same token deterministically', () => {
  const token = 'known-token';

  assert.equal(hashToken(token, 'test-secret'), hashToken(token, 'test-secret'));
  assert.notEqual(hashToken(token, 'test-secret'), hashToken(token, 'other-secret'));
});

test('does not expose the raw token in its hash', () => {
  const token = createRawToken();

  assert.equal(hashToken(token, 'test-secret').includes(token), false);
});
