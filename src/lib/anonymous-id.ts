import { getItem, KEYS, setItem } from '@/lib/storage';

export function getAnonymousUserId(): string {
  const existing = getItem<string | null>(KEYS.ANONYMOUS_ID, null);
  if (existing) return existing;

  const generated = `anon-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  setItem(KEYS.ANONYMOUS_ID, generated);
  return generated;
}
