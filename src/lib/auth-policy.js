export function authorizeUser({ sessionUserId, requestedUserId }) {
  if (!sessionUserId) return { ok: false, status: 401, error: 'Authentication required' };
  if (requestedUserId && requestedUserId !== sessionUserId) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true, userId: sessionUserId };
}
