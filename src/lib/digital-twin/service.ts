import { randomUUID } from 'node:crypto';
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

  await prisma.$executeRaw`
    INSERT INTO digitaltwinprofile
      (id, userId, version, generatedAt, dataStartDate, dataEndDate, dataQuality, persona, behaviorProfile, nutritionProfile, trainingProfile, plateauProfile, modelSummary, confidence, createdAt)
    VALUES
      (${profileId}, ${userId}, ${'digital-twin-v1'}, ${now}, ${dataStartDate}, ${dataEndDate}, ${toJsonText(features.dataQuality)}, ${toJsonText(features.persona)}, ${toJsonText(features.behaviorProfile)}, ${toJsonText(features.nutritionProfile)}, ${toJsonText(features.trainingProfile)}, ${toJsonText(features.plateauProfile)}, ${toJsonText(features.modelSummary)}, ${features.confidence}, ${now})
  `;

  await Promise.all([7, 14, 30].map(windowDays => upsertFeatureSnapshotRaw(userId, snapshotDate, windowDays, features)));

  const predictionId = makeId('dtpdr');
  await prisma.$executeRaw`
    INSERT INTO digitaltwinprediction
      (id, userId, profileId, scenarioId, horizonDays, currentWeight, predictedWeight, goalProbability, slopeKgPerDay, plateauRisk, forecast, assumptions, confidence, modelVersion, createdAt)
    VALUES
      (${predictionId}, ${userId}, ${profileId}, ${null}, ${horizonDays}, ${baseline.currentWeight}, ${baseline.predictedWeight ?? null}, ${baseline.goalProbability}, ${baseline.slopeKgPerDay}, ${baseline.plateauRisk}, ${toJsonText(baseline.forecast)}, ${toJsonText(baseline.assumptions)}, ${baseline.confidence}, ${baseline.modelVersion}, ${now})
  `;

  const scenarioRecords = [];
  for (const scenario of scenarios) {
    const scenarioId = makeId('dts');
    await prisma.$executeRaw`
      INSERT INTO digitaltwinscenario
        (id, userId, profileId, type, title, assumptions, result, status, createdAt)
      VALUES
        (${scenarioId}, ${userId}, ${profileId}, ${scenario.type}, ${scenario.title}, ${toJsonText(scenario.assumptions)}, ${toJsonText(scenario.result || {})}, ${scenario.status}, ${now})
    `;
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
  const [profile] = await prisma.$queryRaw<RawProfileRecord[]>`
    SELECT id, userId, version, generatedAt, dataStartDate, dataEndDate, dataQuality, persona, behaviorProfile, nutritionProfile, trainingProfile, plateauProfile, modelSummary, confidence
    FROM digitaltwinprofile
    WHERE userId = ${userId}
    ORDER BY generatedAt DESC
    LIMIT 1
  `;
  if (!profile) return null;
  const [prediction, scenarios] = await Promise.all([
    prisma.$queryRaw<RawPredictionRecord[]>`
      SELECT id, horizonDays, currentWeight, predictedWeight, goalProbability, slopeKgPerDay, plateauRisk, forecast, assumptions, confidence
      FROM digitaltwinprediction
      WHERE userId = ${userId} AND profileId = ${profile.id}
      ORDER BY createdAt DESC
      LIMIT 1
    `.then(rows => rows[0]),
    prisma.$queryRaw<RawScenarioRecord[]>`
      SELECT id, type, title, assumptions, result, status
      FROM digitaltwinscenario
      WHERE userId = ${userId} AND profileId = ${profile.id}
      ORDER BY createdAt ASC
      LIMIT 8
    `,
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
  await prisma.$executeRaw`
    INSERT INTO digitaltwinscenario
      (id, userId, profileId, type, title, assumptions, result, status, createdAt)
    VALUES
      (${scenarioId}, ${userId}, ${bundle.profile.id || null}, ${scenario.type}, ${scenario.title}, ${toJsonText(scenario.assumptions)}, ${toJsonText(scenario.result || {})}, ${scenario.status}, ${new Date()})
  `;
  return {
    scenario: { ...scenario, id: scenarioId },
    prediction: bundle.prediction,
    explanation: scenario.result?.explanation || '',
  };
}

export async function listDigitalTwinScenarios(userId: string) {
  const prisma = getPrisma();
  const scenarios = await prisma.$queryRaw<RawScenarioRecord[]>`
    SELECT id, type, title, assumptions, result, status
    FROM digitaltwinscenario
    WHERE userId = ${userId}
    ORDER BY createdAt DESC
    LIMIT 30
  `;
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
  const id = makeId('dtfs');
  const featureJson = toJsonText(features);
  await prisma.$executeRaw`
    INSERT INTO digitaltwinfeaturesnapshot
      (id, userId, date, windowDays, features, createdAt)
    VALUES
      (${id}, ${userId}, ${toDate(date)}, ${windowDays}, ${featureJson}, ${new Date()})
    ON DUPLICATE KEY UPDATE features = ${featureJson}
  `;
}

function makeId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function toJsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
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
