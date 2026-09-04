const RETRYABLE_CODES = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ER_CONNECTION_TIMEOUT',
  'ER_GET_CONNECTION_TIMEOUT',
  'PROTOCOL_CONNECTION_LOST',
]);

export async function withAuthDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 1;
  const delayMs = options.delayMs ?? 250;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries || !isTransientDatabaseError(error)) throw error;
      if (delayMs > 0) await sleep(delayMs);
    }
  }
}

function isTransientDatabaseError(error: unknown): boolean {
  const code = findErrorField(error, 'code');
  if (typeof code === 'string' && RETRYABLE_CODES.has(code)) return true;

  return ['message', 'originalMessage'].some(field => {
    const message = findErrorField(error, field);
    return typeof message === 'string'
      && /connection timeout|failed to create socket|connection lost|connection reset|server has gone away|can't reach database/i.test(message);
  });
}

function findErrorField(error: unknown, field: string): unknown {
  let current: unknown = error;
  for (let depth = 0; current && depth < 3; depth += 1) {
    if (typeof current === 'object' && current !== null && field in current) {
      return (current as Record<string, unknown>)[field];
    }
    current = typeof current === 'object' && current !== null
      ? (current as { cause?: unknown }).cause
      : null;
  }
  return undefined;
}

function sleep(delayMs: number) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}
