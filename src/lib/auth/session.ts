import { getPrisma } from '@/lib/prisma';
import { createRawToken, hashToken } from '@/lib/auth/tokens';
import { getRequestUserAgent, hashRequestIp } from '@/lib/auth/request';

export const AUTH_COOKIE_NAME = 'fla_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const LAST_SEEN_WRITE_INTERVAL_MS = 15 * 60 * 1_000;

export interface AuthContext {
  authUserId: string;
  userId: string | null;
  sessionId: string;
  email: string;
}

export async function createSession(authUserId: string, request: Request) {
  const rawToken = createRawToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const session = await getPrisma().session.create({
    data: {
      authUserId,
      tokenHash: hashToken(rawToken),
      expiresAt,
      lastSeenAt: now,
      userAgent: getRequestUserAgent(request),
      ipHash: hashRequestIp(request),
    },
  });
  return { rawToken, sessionId: session.id, expiresAt };
}

export async function getSessionFromRequest(request: Request): Promise<AuthContext | null> {
  const rawToken = readCookie(request.headers.get('cookie'), AUTH_COOKIE_NAME);
  if (!rawToken || !process.env.AUTH_SECRET) return null;

  const session = await getPrisma().session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { authUser: { include: { user: { select: { id: true } } } } },
  });
  const now = new Date();
  if (!session || session.revokedAt || session.expiresAt <= now || session.authUser.status !== 'active') return null;

  if (now.getTime() - session.lastSeenAt.getTime() >= LAST_SEEN_WRITE_INTERVAL_MS) {
    void getPrisma().session.update({ where: { id: session.id }, data: { lastSeenAt: now } }).catch(() => undefined);
  }

  return {
    authUserId: session.authUserId,
    userId: session.authUser.user?.id || null,
    sessionId: session.id,
    email: session.authUser.email,
  };
}

export async function revokeCurrentSession(request: Request) {
  const context = await getSessionFromRequest(request);
  if (!context) return;
  await getPrisma().session.update({ where: { id: context.sessionId }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(authUserId: string) {
  await getPrisma().session.updateMany({
    where: { authUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function sessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
    maxAge: expiresAt ? undefined : 0,
  };
}

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) return valueParts.join('=') || null;
  }
  return null;
}
