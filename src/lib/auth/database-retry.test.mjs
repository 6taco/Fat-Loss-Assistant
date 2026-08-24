import assert from 'node:assert/strict';
import test from 'node:test';

import { withAuthDatabaseRetry } from './database-retry.js';

test('retries a transient database connection failure once', async () => {
  let attempts = 0;

  const result = await withAuthDatabaseRetry(async () => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error('Connection timeout while establishing TLS socket');
      error.code = 'ER_CONNECTION_TIMEOUT';
      throw error;
    }
    return 'connected';
  }, { delayMs: 0 });

  assert.equal(result, 'connected');
  assert.equal(attempts, 2);
});

test('does not retry a non-transient database failure', async () => {
  let attempts = 0;

  await assert.rejects(
    withAuthDatabaseRetry(async () => {
      attempts += 1;
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      throw error;
    }, { delayMs: 0 }),
  );

  assert.equal(attempts, 1);
});

test('retries an adapter-wrapped socket timeout', async () => {
  let attempts = 0;

  const result = await withAuthDatabaseRetry(async () => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error('Prisma driver adapter request failed');
      error.cause = {
        originalCode: '45012',
        originalMessage: 'Connection timeout: failed to create socket',
      };
      throw error;
    }
    return 'connected';
  }, { delayMs: 0 });

  assert.equal(result, 'connected');
  assert.equal(attempts, 2);
});
