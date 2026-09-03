// Runs an async worker over items with a fixed number of concurrent slots.
// Unlike Promise.all, memory and downstream pressure stay bounded; unlike a
// serial for-loop, slow LLM calls from one item don't block the others.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function runSlot() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index]) };
      } catch (error) {
        results[index] = { status: 'rejected', reason: error };
      }
    }
  }

  const slots = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: slots }, () => runSlot()));
  return results;
}
