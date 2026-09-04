export function authorizeUser({ sessionUserId, requestedUserId }: {
  sessionUserId: string | null | undefined;
  requestedUserId?: string | null;
}):
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: 'Authentication required' | 'Forbidden' } {
  if (!sessionUserId) return { ok: false, status: 401, error: 'Authentication required' };
  if (requestedUserId && requestedUserId !== sessionUserId) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true, userId: sessionUserId };
}
