import { createHmac, randomBytes } from 'node:crypto';

export function createRawToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string, secret: string = process.env.AUTH_SECRET || ''): string {
  if (!secret) throw new Error('AUTH_SECRET is required');
  return createHmac('sha256', secret).update(token).digest('hex');
}
