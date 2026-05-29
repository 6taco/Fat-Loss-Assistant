import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import {
  chatToResponse,
  dateToISODate,
  dayPlanToResponse,
  mealLogToResponse,
  toDate,
  userToResponse,
  weightToResponse,
} from '@/lib/server-mappers';
import { extractDigitalTwinFeatures, getDataRange } from '@/lib/digital-twin/feature-extractor';
import { buildBaselinePrediction, defaultScenarios, simulateScenario } from '@/lib/digital-twin/scenario-simulator';
import type { DigitalTwinBundle, DigitalTwinDataSet, DigitalTwinProfileDto, DigitalTwinScenarioDto, ScenarioInput } from '@/lib/digital-twin/types';

export async function generateDigitalTwin(userId: string, options: { horizonDays?: number; force?: boolean } = {}): Promise<DigitalTwinBundle> {
  const prisma = getPrisma();
  const horizonDays = options.horizonDays || 30;
  const data = await collectDigitalTwinData(userId);
  const features = extractDigitalTwinFeatures(data, horizonDays);
  const range = getDataRange(data);
  const baseline = buildBaselinePrediction(features, horizonDays);
  const scenarios = defaultScenarios(features, baseline);
  const profileId = makeId('dtp');
  const now = new Date();
  const dataStartDate = range.startDate ? toDate(range.startDate) : null;
  const dataEndDate = range.endDate ? toDate(range.endDate) : null;
  const snapshotDate = range.endDate || dateToISODate(new Date());

  await prisma.digitalTwinProfile.create({
    data: {
      id: profileId,
      userId,
      version: 'digital-twin-v1',
      generatedAt: now,
      dataStartDate,
      dataEndDate,
      dataQuality: toPrismaJson(features.dataQuality),
      persona: toPrismaJson(features.persona),
      behaviorProfile: toPrismaJson(features.behaviorProfile),
      nutritionProfile: toPrismaJson(features.nutritionProfile),
      trainingProfile: toPrismaJson(features.trainingProfile),
      plateauProfile: toPrismaJson(features.plateauProfile),
      modelSummary: toPrismaJson(features.modelSummary),
      confidence: features.confidence,
      createdAt: now,
    },
  });

  await Promise.all([7, 14, 30].map(windowDays => upsertFeatureSnapshotRaw(userId, snapshotDate, windowDays, features)));

  const predictionId = makeId('dtpdr');
  await prisma.digitalTwinPrediction.create({
    data: {
      id: predictionId,
      userId,
      profileId,
      scenarioId: null,
      horizonDays,
      currentWeight: baseline.currentWeight,
      predictedWeight: baseline.predictedWeight ?? null,
      goalProbability: baseline.goalProbability,
      slopeKgPerDay: baseline.slopeKgPerDay,
      plateauRisk: baseline.plateauRisk,
      forecast: toPrismaJson(baseline.forecast),
      assumptions: toPrismaJson(baseline.assumptions),
      confidence: baseline.confidence,
      modelVersion: baseline.modelVersion,
      createdAt: now,
    },
  });

  const scenarioRecords = [];
  for (const scenario of scenarios) {
    const scenarioId = makeId('dts');
    await prisma.digitalTwinScenario.create({
      data: {
        id: scenarioId,
        userId,
        profileId,
        type: scenario.type,
        title: scenario.title,
        assumptions: toPrismaJson(scenario.assumptions),
        result: toPrismaJson(scenario.result || {}),
        status: scenario.status,
        createdAt: now,
      },
    });
    scenarioRecords.push({ ...scenario, id: scenarioId });
  }

  return {
    profile: profileRecordToDto({
      id: profileId,
      userId,
      version: 'digital-twin-v1',
      generatedAt: now,
      dataStartDate,
      dataEndDate,
      dataQuality: features.dataQuality,
      persona: features.persona,
      behaviorProfile: features.behaviorProfile,
      nutritionProfile: features.nutritionProfile,
      trainingProfile: features.trainingProfile,
      plateauProfile: features.plateauProfile,
      modelSummary: features.modelSummary,
      confidence: features.confidence,
    }),
    prediction: { ...baseline, id: predictionId },
    scenarios: scenarioRecords,
  };
}

export async function getLatestDigitalTwin(userId: string): Promise<DigitalTwinBundle | null> {
  const prisma = getPrisma();
  const profile = await prisma.digitalTwinProfile.findFirst({
    where: { userId },
    orderBy: { generatedAt: 'desc' },
  });
  if (!profile) return null;
  const [prediction, scenarios] = await Promise.all([
    prisma.digitalTwinPrediction.findFirst({ where: { userId, profileId: profile.id }, orderBy: { createdAt: 'desc' } }),
    prisma.digitalTwinScenario.findMany({ where: { userId, profileId: profile.id }, orderBy: { createdAt: 'asc' }, take: 8 }),
  ]);
  return {
    profile: profileRecordToDto(profile),
    prediction: prediction ? predictionRecordToDto(prediction) : buildBaselinePrediction(extractDigitalTwinFeatures(await collectDigitalTwinData(userId))),
    scenarios: scenarios.map(scenarioRecordToDto),
  };
}

export async function simulateDigitalTwinScenario(userId: string, scenarioInput: ScenarioInput): Promise<{ scenario: DigitalTwinScenarioDto; prediction: unknown; explanation: string }> {
  const prisma = getPrisma();
  const existing = await getLatestDigitalTwin(userId);
  const bundle = existing || await generateDigitalTwin(userId, { horizonDays: scenarioInput.horizonDays || 30 });
  const features = {
    confidence: bundle.profile.confidence,
    dataQuality: bundle.profile.dataQuality,
    persona: bundle.profile.persona,
    behaviorProfile: bundle.profile.behaviorProfile,
    nutritionProfile: bundle.profile.nutritionProfile,
    trainingProfile: bundle.profile.trainingProfile,
    plateauProfile: bundle.profile.plateauProfile,
    modelSummary: bundle.profile.modelSummary,
  };
  const scenario = simulateScenario(features, bundle.prediction, scenarioInput);
  const scenarioId = makeId('dts');
  await prisma.digitalTwinScenario.create({
    data: {
      id: scenarioId,
      userId,
      profileId: bundle.profile.id || null,
      type: scenario.type,
      title: scenario.title,
      assumptions: toPrismaJson(scenario.assumptions),
      result: toPrismaJson(scenario.result || {}),
      status: scenario.status,
      createdAt: new Date(),
    },
  });
  return {
    scenario: { ...scenario, id: scenarioId },
    prediction: bundle.prediction,
    explanation: scenario.result?.explanation || '',
  };
}

export async function listDigitalTwinScenarios(userId: string) {
  const prisma = getPrisma();
  const scenarios = await prisma.digitalTwinScenario.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return scenarios.map(scenarioRecordToDto);
}

async function collectDigitalTwinData(userId: string): Promise<DigitalTwinDataSet> {
  const prisma = getPrisma();
  const prismaAny = prisma as unknown as {
    agentFinding?: { findMany: (args: unknown) => Promise<unknown[]> };
    coachInsight?: { findMany: (args: unknown) => Promise<unknown[]> };
    actionProposal?: { findMany: (args: unknown) => Promise<Array<{ type: string; status: string; createdAt?: Date }>> };
  };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  const [weights, plans, meals, chatMessages, agentFindings, coachInsights, actionProposals] = await Promise.all([
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.dayPlan.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.mealLog.findMany({ where: { userId }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    prisma.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, take: 100 }),
    prismaAny.agentFinding?.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []) ?? Promise.resolve([]),
    prismaAny.coachInsight?.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []) ?? Promise.resolve([]),
    prismaAny.actionProposal?.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }).catch(() => []) ?? Promise.resolve([]),
  ]);
  return {
    user: userToResponse(user),
    weights: weights.map(weightToResponse),
    plans: plans.map(dayPlanToResponse),
    meals: meals.map(mealLogToResponse),
    chatMessages: chatMessages.map(chatToResponse).map(message => ({ role: message.role, content: message.content, createdAt: message.timestamp })),
    agentFindings,
    coachInsights,
    actionProposals: actionProposals.map(item => ({ type: item.type, status: item.status, createdAt: item.createdAt })),
  };
}

function profileRecordToDto(record: {
  id: string;
  userId: string;
  version: string;
  generatedAt: Date;
  dataStartDate: Date | null;
  dataEndDate: Date | null;
  dataQuality: unknown;
  persona: unknown;
  behaviorProfile: unknown;
  nutritionProfile: unknown;
  trainingProfile: unknown;
  plateauProfile: unknown;
  modelSummary: unknown;
  confidence: string;
}): DigitalTwinProfileDto {
  return {
    id: record.id,
    userId: record.userId,
    version: 'digital-twin-v1',
    generatedAt: record.generatedAt.toISOString(),
    dataStartDate: record.dataStartDate ? dateToISODate(record.dataStartDate) : undefined,
    dataEndDate: record.dataEndDate ? dateToISODate(record.dataEndDate) : undefined,
    dataQuality: parseJson(record.dataQuality) as DigitalTwinProfileDto['dataQuality'],
    persona: parseJson(record.persona) as DigitalTwinProfileDto['persona'],
    behaviorProfile: parseJson(record.behaviorProfile) as DigitalTwinProfileDto['behaviorProfile'],
    nutritionProfile: parseJson(record.nutritionProfile) as DigitalTwinProfileDto['nutritionProfile'],
    trainingProfile: parseJson(record.trainingProfile) as DigitalTwinProfileDto['trainingProfile'],
    plateauProfile: parseJson(record.plateauProfile) as DigitalTwinProfileDto['plateauProfile'],
    modelSummary: parseJson(record.modelSummary) as DigitalTwinProfileDto['modelSummary'],
    confidence: normalizeConfidence(record.confidence),
  };
}

function predictionRecordToDto(record: {
  id: string;
  horizonDays: number;
  currentWeight: number;
  predictedWeight: number | null;
  goalProbability: number;
  slopeKgPerDay: number;
  plateauRisk: string;
  forecast: unknown;
  assumptions: unknown;
  confidence: string;
}): DigitalTwinBundle['prediction'] {
  const forecast = parseJson(record.forecast);

  return {
    id: record.id,
    horizonDays: record.horizonDays,
    currentWeight: record.currentWeight,
    predictedWeight: record.predictedWeight ?? undefined,
    goalProbability: record.goalProbability,
    slopeKgPerDay: record.slopeKgPerDay,
    plateauRisk: normalizePlateauRisk(record.plateauRisk),
    forecast: Array.isArray(forecast) ? forecast as DigitalTwinBundle['prediction']['forecast'] : [],
    assumptions: parseObject(record.assumptions),
    confidence: normalizeConfidence(record.confidence),
    modelVersion: 'digital-twin-v1' as const,
  };
}

function scenarioRecordToDto(record: {
  id: string;
  type: string;
  title: string;
  assumptions: unknown;
  result: unknown;
  status: string;
}): DigitalTwinScenarioDto {
  return {
    id: record.id,
    type: normalizeScenarioType(record.type),
    title: record.title,
    assumptions: parseObject(record.assumptions),
    result: parseObject(record.result) as DigitalTwinScenarioDto['result'],
    status: record.status === 'failed' ? 'failed' as const : 'completed' as const,
  };
}

function normalizeConfidence(value: string) {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'low';
}

function normalizePlateauRisk(value: string) {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'unknown') return value;
  return 'unknown';
}

function normalizeScenarioType(value: string) {
  if (
    value === 'maintain_current'
    || value === 'reduce_calories'
    || value === 'add_steps'
    || value === 'improve_adherence'
    || value === 'improve_protein'
    || value === 'reorder_carb_cycle'
  ) return value;
  return 'maintain_current';
}

type RawProfileRecord = {
  id: string;
  userId: string;
  version: string;
  generatedAt: Date;
  dataStartDate: Date | null;
  dataEndDate: Date | null;
  dataQuality: unknown;
  persona: unknown;
  behaviorProfile: unknown;
  nutritionProfile: unknown;
  trainingProfile: unknown;
  plateauProfile: unknown;
  modelSummary: unknown;
  confidence: string;
};

type RawPredictionRecord = {
  id: string;
  horizonDays: number;
  currentWeight: number;
  predictedWeight: number | null;
  goalProbability: number;
  slopeKgPerDay: number;
  plateauRisk: string;
  forecast: unknown;
  assumptions: unknown;
  confidence: string;
};

type RawScenarioRecord = {
  id: string;
  type: string;
  title: string;
  assumptions: unknown;
  result: unknown;
  status: string;
};

async function upsertFeatureSnapshotRaw(userId: string, date: string, windowDays: number, features: unknown) {
  const prisma = getPrisma();
  await prisma.digitalTwinFeatureSnapshot.upsert({
    where: {
      userId_date_windowDays: {
        userId,
        date: toDate(date),
        windowDays,
      },
    },
    create: {
      id: makeId('dtfs'),
      userId,
      date: toDate(date),
      windowDays,
      features: toPrismaJson(features),
    },
    update: {
      features: toPrismaJson(features),
    },
  });
}

function makeId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function toJsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseObject(value: unknown): Record<string, unknown> {
  const parsed = parseJson(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}
