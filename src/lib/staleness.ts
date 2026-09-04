const DEFAULT_FETCH_TTL_MS = 60_000;

// Tab switches remount pages and re-run their load effects; within the TTL a
// store serves its cached state instead of refetching. Mutations refresh the
// stamp (their optimistic write is as fresh as the server), and flows that
// must see new data reset the stamp before reloading.
export function isFreshData(lastFetchedAt: number | undefined, ttlMs: number = DEFAULT_FETCH_TTL_MS): boolean {
  return typeof lastFetchedAt === 'number' && Date.now() - lastFetchedAt < ttlMs;
}
