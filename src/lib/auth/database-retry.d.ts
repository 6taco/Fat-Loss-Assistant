export declare function withAuthDatabaseRetry<T>(operation: () => Promise<T>, options?: {
  retries?: number;
  delayMs?: number;
}): Promise<T>;
