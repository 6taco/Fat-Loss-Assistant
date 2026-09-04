import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeEmail, validateEmail, validatePassword } from './validation.ts';

test('normalizes email addresses before persistence', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
});

test('rejects malformed email addresses', () => {
  assert.equal(validateEmail('not-an-email'), 'Enter a valid email address');
});

test('accepts a password at the minimum length', () => {
  assert.equal(validatePassword('12345678'), null);
});

test('rejects passwords shorter than eight characters', () => {
  assert.equal(validatePassword('1234567'), 'Password must be 8-128 characters');
});

test('rejects passwords longer than 128 characters', () => {
  assert.equal(validatePassword('x'.repeat(129)), 'Password must be 8-128 characters');
});

test('rejects a password that is exactly the email', () => {
  assert.equal(validatePassword('user@example.com', 'user@example.com'), 'Password cannot match the email');
});
