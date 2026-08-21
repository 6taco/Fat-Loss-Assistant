import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorizeUser,
} from './auth-policy.js';

test('requires authentication before accessing a user resource', () => {
  assert.deepEqual(authorizeUser({ sessionUserId: null, requestedUserId: 'user-1' }), {
    ok: false,
    status: 401,
    error: 'Authentication required',
  });
});

test('rejects access to another user resource', () => {
  assert.deepEqual(authorizeUser({ sessionUserId: 'user-1', requestedUserId: 'user-2' }), {
    ok: false,
    status: 403,
    error: 'Forbidden',
  });
});

test('authorizes the session user when the requested resource matches', () => {
  assert.deepEqual(authorizeUser({ sessionUserId: 'user-1', requestedUserId: 'user-1' }), {
    ok: true,
    userId: 'user-1',
  });
});
