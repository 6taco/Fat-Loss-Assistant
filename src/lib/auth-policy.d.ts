export declare function authorizeUser(input: {
  sessionUserId: string | null | undefined;
  requestedUserId?: string | null;
}):
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: 'Authentication required' | 'Forbidden' };
