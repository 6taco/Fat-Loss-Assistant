import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export function createRegistrationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function isRegistrationCode(value) {
  return typeof value === 'string' && /^\d{6}$/.test(value);
}

export function hashRegistrationCode(code, secret = process.env.AUTH_SECRET || '') {
  if (!secret) throw new Error('AUTH_SECRET is required');
  return createHmac('sha256', secret).update(code).digest('hex');
}

export function registrationCodeMatches(code, storedHash, secret = process.env.AUTH_SECRET || '') {
  if (!isRegistrationCode(code) || typeof storedHash !== 'string') return false;
  const actual = Buffer.from(hashRegistrationCode(code, secret), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
