import { createHash, timingSafeEqual } from 'node:crypto';
import { getSessionFromRequest, type AuthContext } from '@/lib/auth/session';

export type AuthResult =
  | { context: AuthContext; response: null }
  | { context: null; response: Response };

export async function optionalAuth(request: Request): Promise<AuthContext | null> {
  return getSessionFromRequest(request);
}

export async function requireAuth(request: Request): Promise<AuthResult> {
  const context = await getSessionFromRequest(request);
  if (!context) {
    return { context: null, response: Response.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  return { context, response: null };
}

export async function requireBusinessUser(request: Request, requestedUserId?: string | null): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (auth.response) return auth;
  if (!auth.context.userId) {
    return { context: null, response: Response.json({ error: 'PROFILE_REQUIRED' }, { status: 409 }) };
  }
  if (requestedUserId && requestedUserId !== auth.context.userId) {
    return { context: null, response: Response.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return auth;
}

export function requireAdmin(request: Request) {
  return requireBearerSecret(request, process.env.ADMIN_API_KEY, 'ADMIN_API_KEY');
}

export function requireCron(request: Request) {
  return requireBearerSecret(request, process.env.CRON_SECRET, 'CRON_SECRET');
}

function requireBearerSecret(request: Request, secret: string | undefined, name: string) {
  if (!secret) {
    // Same 401 as a wrong secret: the response must not reveal whether the
    // instance configured the key at all.
    console.warn(`[auth] ${name} is not configured; rejecting privileged request`);
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const header = request.headers.get('authorization') || '';
  const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  // Compare SHA-256 digests: timingSafeEqual needs equal-length buffers, and
  // digesting first keeps both the content and the length of the secret hidden.
  const presentedDigest = createHash('sha256').update(presented).digest();
  const secretDigest = createHash('sha256').update(secret).digest();
  if (!timingSafeEqual(presentedDigest, secretDigest)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
