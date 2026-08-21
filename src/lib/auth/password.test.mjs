import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword, verifyPassword } from './password.js';

test('hashes and verifies a password without storing it in plaintext', async () => {
  const encoded = await hashPassword('correct horse battery staple');

  assert.match(encoded, /^scrypt\$N=32768,r=8,p=1\$[^$]+\$[^$]+$/);
  assert.notEqual(encoded, 'correct horse battery staple');
  assert.equal(await verifyPassword('correct horse battery staple', encoded), true);
  assert.equal(await verifyPassword('wrong password', encoded), false);
});

test('uses a unique salt for each password hash', async () => {
  const first = await hashPassword('same password');
  const second = await hashPassword('same password');

  assert.notEqual(first, second);
});

test('rejects malformed password hashes', async () => {
  assert.equal(await verifyPassword('password', 'not-a-scrypt-hash'), false);
});
