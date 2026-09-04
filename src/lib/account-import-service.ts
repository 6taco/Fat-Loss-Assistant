import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { IMPORT_DATASETS, validateImportChunk } from '@/lib/account-import';
import { toDate } from '@/lib/server-mappers';

const MAX_JSON_BYTES = 512 * 1024;

type ImportDataset = typeof IMPORT_DATASETS[number];
type ImportItem = Record<string, unknown> & { sourceId: string };

export class AccountImportError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
    this.name = 'AccountImportError';
  }
}

export async function startImport(authUserId: string, input: { sourceAccountId?: string; datasets?: unknown }) {
  const datasets = Array.isArray(input.datasets)
    ? [...new Set(input.datasets.filter((item): item is string => typeof item === 'string'))]
    : [];
  if (!datasets.length || datasets.some(dataset => !(IMPORT_DATASETS as readonly string[]).includes(dataset))) {
    throw new AccountImportError('INVALID_DATASETS');
  }

  return getPrisma().dataImportBatch.create({
    data: {
      authUserId,
      sourceAccountId: input.sourceAccountId?.slice(0, 255) || null,
      counts: { expectedDatasets: datasets } as Prisma.InputJsonValue,
    },
  });
}

export async function storeImportChunk(authUserId: string, input: {
  importId?: string;
  dataset?: string;
  chunkIndex?: number;
  items?: unknown;
}) {
  if (!input.importId || !input.dataset) throw new AccountImportError('INVALID_IMPORT_CHUNK');
  const validation = validateImportChunk(input.dataset, input.items);
  if (!validation.ok) throw new AccountImportError(validation.error);
  if (Buffer.byteLength(JSON.stringify(validation.items), 'utf8') > MAX_JSON_BYTES) {
    throw new AccountImportError('IMPORT_CHUNK_TOO_LARGE', 413);
  }

  const prisma = getPrisma();
  const batch = await prisma.dataImportBatch.findFirst({
    where: { id: input.importId, authUserId },
  });
  if (!batch) throw new AccountImportError('IMPORT_NOT_FOUND', 404);
  if (batch.status === 'completed') throw new AccountImportError('IMPORT_ALREADY_COMPLETED', 409);

  const chunkIndex = Number.isInteger(input.chunkIndex) && input.chunkIndex! >= 0 ? input.chunkIndex! : 0;
  const chunk = await prisma.dataImportChunk.upsert({
    where: { batchId_dataset_chunkIndex: { batchId: batch.id, dataset: input.dataset, chunkIndex } },
    create: {
      batchId: batch.id,
      dataset: input.dataset,
      chunkIndex,
      payload: validation.items as Prisma.InputJsonValue,
    },
    update: { payload: validation.items as Prisma.InputJsonValue },
  });
  if (batch.status === 'pending') {
    await prisma.dataImportBatch.update({ where: { id: batch.id }, data: { status: 'processing' } });
  }
  return chunk;
}

export async function completeImport(authUserId: string, importId: string) {
  const prisma = getPrisma();
  const batch = await prisma.dataImportBatch.findFirst({
    where: { id: importId, authUserId },
    include: { chunks: { orderBy: [{ dataset: 'asc' }, { chunkIndex: 'asc' }] } },
  });
  if (!batch) throw new AccountImportError('IMPORT_NOT_FOUND', 404);
  if (batch.status === 'completed') {
    const user = await prisma.user.findUnique({ where: { authUserId }, select: { id: true } });
    return { batch, counts: batch.counts, userId: user?.id || null };
  }

  const grouped = new Map<string, ImportItem[]>();
  for (const chunk of batch.chunks) {
    const validation = validateImportChunk(chunk.dataset, chunk.payload);
    if (!validation.ok) throw new AccountImportError(validation.error);
    grouped.set(chunk.dataset, [...(grouped.get(chunk.dataset) || []), ...(validation.items as ImportItem[])]);
  }

  try {
    const result = await prisma.$transaction(async tx => {
      let userId = (await tx.user.findUnique({ where: { authUserId }, select: { id: true } }))?.id || null;
      const counts: Record<string, { created: number; updated: number; skipped: number }> = {};

      const profileItems = grouped.get('user') || [];
      if (profileItems.length) {
        const profile = profileItems[profileItems.length - 1];
        const saved = await upsertImportedUser(tx, authUserId, profile);
        userId = saved.id;
        counts.user = { created: 0, updated: 1, skipped: Math.max(0, profileItems.length - 1) };
        await recordMapping(tx, authUserId, batch.id, 'user', profile.sourceId, saved.id);
      }

      const hasBusinessData = [...grouped.keys()].some(dataset => dataset !== 'user');
      if (!userId && hasBusinessData) throw new AccountImportError('PROFILE_REQUIRED', 409);

      if (userId) {
        for (const dataset of IMPORT_DATASETS) {
          if (dataset === 'user') continue;
          const items = grouped.get(dataset) || [];
          if (!items.length) continue;
          counts[dataset] = await importDataset(tx, authUserId, batch.id, userId, dataset, items);
        }
      }

      const completedAt = new Date();
      const completed = await tx.dataImportBatch.update({
        where: { id: batch.id },
        data: { status: 'completed', counts: counts as Prisma.InputJsonValue, completedAt, error: null },
      });
      await tx.dataImportChunk.deleteMany({ where: { batchId: batch.id } });
      return { batch: completed, counts, userId };
    });
    return result;
  } catch (error) {
    await prisma.dataImportBatch.update({
      where: { id: batch.id },
      data: { status: 'failed', error: importErrorMessage(error).slice(0, 2000) },
    }).catch(() => undefined);
    throw error;
  }
}

async function importDataset(
  tx: Prisma.TransactionClient,
  authUserId: string,
  batchId: string,
  userId: string,
  dataset: ImportDataset,
  items: ImportItem[],
) {
  const counts = { created: 0, updated: 0, skipped: 0 };
  for (const item of items) {
    const mapped = await tx.dataImportItem.findUnique({
      where: { authUserId_dataset_sourceId: { authUserId, dataset, sourceId: item.sourceId } },
    });
    if (mapped) {
      counts.skipped += 1;
      continue;
    }

    const target = await writeDatasetItem(tx, dataset, userId, item);
    await recordMapping(tx, authUserId, batchId, dataset, item.sourceId, target.id);
    counts[target.updated ? 'updated' : 'created'] += 1;
  }
  return counts;
}

async function writeDatasetItem(tx: Prisma.TransactionClient, dataset: ImportDataset, userId: string, item: ImportItem) {
  if (dataset === 'weights') {
    const date = toDate(requiredString(item.date, 'INVALID_DATE'));
    const existing = await tx.weightEntry.findUnique({ where: { userId_date: { userId, date } } });
    const record = await tx.weightEntry.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, weight: requiredNumber(item.weight, 'INVALID_WEIGHT') },
      update: { weight: requiredNumber(item.weight, 'INVALID_WEIGHT') },
    });
    return { id: record.id, updated: Boolean(existing) };
  }

  if (dataset === 'plans') {
    const date = toDate(requiredString(item.date, 'INVALID_DATE'));
    const existing = await tx.dayPlan.findUnique({ where: { userId_date: { userId, date } } });
    const data = {
      carbType: enumValue(item.carbType, ['high', 'mid', 'low'] as const, 'INVALID_CARB_TYPE'),
      calories: integer(item.calories, 0, 10000, 'INVALID_CALORIES'),
      carb: integer(item.carb, 0, 2000, 'INVALID_MACROS'),
      protein: integer(item.protein, 0, 1000, 'INVALID_MACROS'),
      fat: integer(item.fat, 0, 1000, 'INVALID_MACROS'),
      completed: Boolean(item.completed),
      muscleGroup: optionalString(item.muscleGroup, 64),
      trainingLabel: optionalString(item.trainingLabel, 255),
    };
    const record = await tx.dayPlan.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ...data },
      update: data,
    });
    return { id: record.id, updated: Boolean(existing) };
  }

  if (dataset === 'meals') {
    const record = await tx.mealLog.create({
      data: {
        userId,
        date: toDate(requiredString(item.date, 'INVALID_DATE')),
        mealType: requiredString(item.mealType, 'INVALID_MEAL_TYPE').slice(0, 64),
        description: requiredString(item.description, 'INVALID_DESCRIPTION').slice(0, 5000),
        items: jsonValue(item.items, []),
        carb: numberInRange(item.carb, 0, 2000, 'INVALID_MACROS'),
        protein: numberInRange(item.protein, 0, 1000, 'INVALID_MACROS'),
        fat: numberInRange(item.fat, 0, 1000, 'INVALID_MACROS'),
        calories: item.calories == null ? null : integer(item.calories, 0, 10000, 'INVALID_CALORIES'),
        source: optionalString(item.source, 64) || 'local_import',
      },
    });
    return { id: record.id, updated: false };
  }

  if (dataset === 'chat') {
    const record = await tx.chatMessage.create({
      data: {
        userId,
        role: enumValue(item.role, ['user', 'ai'] as const, 'INVALID_CHAT_ROLE'),
        content: requiredString(item.content, 'INVALID_CONTENT').slice(0, 20000),
        cards: item.cards == null ? Prisma.JsonNull : jsonValue(item.cards, []),
        createdAt: optionalDateTime(item.timestamp) || new Date(),
      },
    });
    return { id: record.id, updated: false };
  }

  if (dataset === 'dailyReports') {
    const date = toDate(requiredString(item.date, 'INVALID_DATE'));
    const existing = await tx.dailyReport.findUnique({ where: { userId_date: { userId, date } } });
    const record = await tx.dailyReport.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId, date,
        score: integer(item.score, 0, 100, 'INVALID_SCORE'),
        summary: requiredString(item.summary, 'INVALID_SUMMARY').slice(0, 10000),
        suggestions: jsonValue(item.suggestions, []),
        readAt: optionalDateTime(item.readAt),
      },
      update: {
        score: integer(item.score, 0, 100, 'INVALID_SCORE'),
        summary: requiredString(item.summary, 'INVALID_SUMMARY').slice(0, 10000),
        suggestions: jsonValue(item.suggestions, []),
        readAt: optionalDateTime(item.readAt),
      },
    });
    return { id: record.id, updated: Boolean(existing) };
  }

  if (dataset === 'weeklyReports') {
    const weekIndex = integer(item.weekIndex, 1, 10000, 'INVALID_WEEK_INDEX');
    const existing = await tx.weeklyReport.findUnique({ where: { userId_weekIndex: { userId, weekIndex } } });
    const data = {
      startDate: toDate(requiredString(item.startDate, 'INVALID_DATE')),
      endDate: toDate(requiredString(item.endDate, 'INVALID_DATE')),
      score: integer(item.score, 0, 100, 'INVALID_SCORE'),
      summary: requiredString(item.summary, 'INVALID_SUMMARY').slice(0, 10000),
      suggestions: jsonValue(item.suggestions, []),
      metrics: jsonValue(item.metrics, {}),
      risks: jsonValue(item.risks, []),
      readAt: optionalDateTime(item.readAt),
    };
    const record = await tx.weeklyReport.upsert({
      where: { userId_weekIndex: { userId, weekIndex } },
      create: { userId, weekIndex, ...data },
      update: data,
    });
    return { id: record.id, updated: Boolean(existing) };
  }

  if (dataset === 'lifestyle') {
    const existing = await tx.userLifestyleProfile.findUnique({ where: { userId } });
    const data = lifestyleData(item);
    const record = await tx.userLifestyleProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return { id: record.id, updated: Boolean(existing) };
  }

  throw new AccountImportError('UNSUPPORTED_DATASET');
}

async function upsertImportedUser(tx: Prisma.TransactionClient, authUserId: string, item: ImportItem) {
  const data = {
    name: optionalString(item.name, 20) || '用户',
    gender: enumValue(item.gender, ['male', 'female'] as const, 'INVALID_GENDER'),
    age: integer(item.age, 14, 80, 'INVALID_AGE'),
    height: numberInRange(item.height, 120, 230, 'INVALID_HEIGHT'),
    weight: numberInRange(item.weight, 30, 250, 'INVALID_WEIGHT'),
    bodyFat: numberInRange(item.bodyFat, 5, 60, 'INVALID_BODY_FAT'),
    trainingFrequency: integer(item.trainingFrequency ?? 0, 0, 14, 'INVALID_TRAINING_FREQUENCY'),
    trainingIntensity: enumValue(item.trainingIntensity ?? 'medium', ['low', 'medium', 'high'] as const, 'INVALID_TRAINING_INTENSITY'),
    startDate: toDate(typeof item.startDate === 'string' ? item.startDate : new Date().toISOString().slice(0, 10)),
    initialWeightDate: typeof item.initialWeightDate === 'string' ? toDate(item.initialWeightDate) : null,
    goalWeight: numberInRange(item.goalWeight ?? item.weight, 30, 250, 'INVALID_GOAL_WEIGHT'),
    somatotype: optionalString(item.somatotype, 32) || 'mesomorph',
    trainingSchedule: item.trainingSchedule == null ? undefined : jsonValue(item.trainingSchedule, []),
  };
  return tx.user.upsert({ where: { authUserId }, create: { authUserId, ...data }, update: data });
}

function lifestyleData(item: ImportItem) {
  return {
    sleepRegularity: optionalString(item.sleepRegularity, 64) || 'mixed',
    averageSleepHours: item.averageSleepHours == null ? null : numberInRange(item.averageSleepHours, 3, 12, 'INVALID_SLEEP_HOURS'),
    workStudyRhythm: optionalString(item.workStudyRhythm, 64) || 'flexible',
    oftenStaysUpLate: Boolean(item.oftenStaysUpLate),
    isStudent: Boolean(item.isStudent),
    dietRegularity: optionalString(item.dietRegularity, 64) || 'mixed',
    bingeRisk: optionalString(item.bingeRisk, 64) || 'low',
    takeawayFrequency: optionalString(item.takeawayFrequency, 64) || 'medium',
    complexPlanTolerance: optionalString(item.complexPlanTolerance, 64) || 'medium',
    hasFitnessHabit: Boolean(item.hasFitnessHabit),
    hasStrengthTraining: Boolean(item.hasStrengthTraining),
    trainingExperience: optionalString(item.trainingExperience, 64) || 'none',
    fatLossGoal: optionalString(item.fatLossGoal, 64) || 'health',
    targetWeeks: item.targetWeeks == null ? null : integer(item.targetWeeks, 2, 104, 'INVALID_TARGET_WEEKS'),
    derivedMetrics: jsonValue(item.derivedMetrics, {}),
  };
}

async function recordMapping(tx: Prisma.TransactionClient, authUserId: string, batchId: string, dataset: string, sourceId: string, targetId: string) {
  await tx.dataImportItem.upsert({
    where: { authUserId_dataset_sourceId: { authUserId, dataset, sourceId } },
    create: { authUserId, batchId, dataset, sourceId, targetId },
    update: { targetId },
  });
}

function requiredString(value: unknown, code: string) {
  if (typeof value !== 'string' || !value.trim()) throw new AccountImportError(code);
  return value.trim();
}

function optionalString(value: unknown, max: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

function requiredNumber(value: unknown, code: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new AccountImportError(code);
  return value;
}

function numberInRange(value: unknown, min: number, max: number, code: string) {
  const result = requiredNumber(value, code);
  if (result < min || result > max) throw new AccountImportError(code);
  return result;
}

function integer(value: unknown, min: number, max: number, code: string) {
  const result = numberInRange(value, min, max, code);
  if (!Number.isInteger(result)) throw new AccountImportError(code);
  return result;
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T, code: string): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new AccountImportError(code);
  return value as T[number];
}

function jsonValue(value: unknown, fallback: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (value == null) return fallback;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function optionalDateTime(value: unknown) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function importErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'IMPORT_FAILED';
}
