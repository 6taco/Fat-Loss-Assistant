import { createHmac } from 'node:crypto';

export function getRequestIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export function hashRequestIp(request: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHmac('sha256', secret).update(getRequestIp(request)).digest('hex');
}

export function getRequestUserAgent(request: Request) {
  return request.headers.get('user-agent')?.slice(0, 512) || null;
}
