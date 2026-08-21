export const IMPORT_DATASETS: readonly string[];

export function sanitizeImportItem(item: unknown): Record<string, unknown>;

export function validateImportChunk(dataset: string, items: unknown):
  | { ok: true; items: Record<string, unknown>[] }
  | { ok: false; error: string };
