export const IMPORT_DATASETS = [
  'user',
  'weights',
  'meals',
  'plans',
  'chat',
  'dailyReports',
  'weeklyReports',
  'lifestyle',
] as const;

const MAX_IMPORT_ITEMS = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeImportItem(item: unknown): Record<string, unknown> {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return {};
  return Object.fromEntries(Object.entries(item).filter(([key]) => !['userId', 'authUserId', 'ownerId'].includes(key)));
}

export function validateImportChunk(dataset: string, items: unknown):
  | { ok: true; items: Record<string, unknown>[] }
  | { ok: false; error: string } {
  if (!(IMPORT_DATASETS as readonly string[]).includes(dataset)) return { ok: false, error: 'UNSUPPORTED_DATASET' };
  if (!Array.isArray(items) || items.length > MAX_IMPORT_ITEMS) return { ok: false, error: 'INVALID_CHUNK_SIZE' };

  for (const rawItem of items) {
    const item = sanitizeImportItem(rawItem);
    const sourceId = item.sourceId;
    if (typeof sourceId !== 'string' || !sourceId.trim() || sourceId.length > 255) {
      return { ok: false, error: 'INVALID_SOURCE_ID' };
    }
    const error = validateDatasetItem(dataset, item);
    if (error) return { ok: false, error };
  }

  return { ok: true, items: items.map(sanitizeImportItem) };
}

function validateDatasetItem(dataset: string, item: Record<string, unknown>): string | null {
  if (dataset === 'user') {
    if (!inRange(item.age, 14, 80)) return 'INVALID_AGE';
    if (!inRange(item.height, 120, 230)) return 'INVALID_HEIGHT';
    if (!inRange(item.weight, 30, 250)) return 'INVALID_WEIGHT';
    if (!inRange(item.bodyFat, 5, 60)) return 'INVALID_BODY_FAT';
    if (item.gender !== 'male' && item.gender !== 'female') return 'INVALID_GENDER';
  }

  if (dataset === 'weights') {
    if (!validDate(item.date)) return 'INVALID_DATE';
    if (!inRange(item.weight, 30, 250)) return 'INVALID_WEIGHT';
  }

  if (dataset === 'meals' || dataset === 'plans' || dataset === 'dailyReports') {
    if (!validDate(item.date)) return 'INVALID_DATE';
  }

  if (dataset === 'weeklyReports') {
    if (!validDate(item.startDate) || !validDate(item.endDate)) return 'INVALID_DATE';
  }

  if (dataset === 'chat' && (typeof item.content !== 'string' || item.content.length > 20000)) {
    return 'INVALID_CONTENT';
  }

  return null;
}

function validDate(value: unknown): boolean {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function inRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
