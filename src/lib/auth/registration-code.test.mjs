import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRegistrationCode,
  hashRegistrationCode,
  isRegistrationCode,
  registrationCodeMatches,
} from './registration-code.ts';

test('creates a six digit registration code', () => {
  for (let index = 0; index < 100; index += 1) {
    assert.match(createRegistrationCode(), /^\d{6}$/);
  }
});

test('accepts only six digit registration codes', () => {
  assert.equal(isRegistrationCode('012345'), true);
  assert.equal(isRegistrationCode('12345'), false);
  assert.equal(isRegistrationCode('1234567'), false);
  assert.equal(isRegistrationCode('12a456'), false);
});

test('hashes registration codes without storing the raw code', () => {
  const hash = hashRegistrationCode('123456', 'test-secret');

  assert.notEqual(hash, '123456');
  assert.equal(hash, hashRegistrationCode('123456', 'test-secret'));
  assert.notEqual(hash, hashRegistrationCode('654321', 'test-secret'));
});

test('compares a submitted code with its stored hash', () => {
  const hash = hashRegistrationCode('123456', 'test-secret');

  assert.equal(registrationCodeMatches('123456', hash, 'test-secret'), true);
  assert.equal(registrationCodeMatches('654321', hash, 'test-secret'), false);
  assert.equal(registrationCodeMatches('bad', hash, 'test-secret'), false);
});
