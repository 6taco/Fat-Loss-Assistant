import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { dateToISODate, toDate } from '@/lib/server-mappers';
import {
  type CalorieDeficitSummary,
  type MealLog,
  type MuscleGroup,
  type WeightPredictionPoint,
  type WeightPredictionResult,
  muscleGroupLabels,
} from '@/lib/mock-data';
import { buildWeightPrediction } from '@/lib/weight-prediction-core';

export type { WeightPredictionInput, WeightPredictionModel } from '@/lib/weight-prediction-core';
export { LinearRegressionWeightModel, buildWeightPrediction } from '@/lib/weight-prediction-core';

export async function generateWeightPrediction(userId: string, horizonDays = 30): Promise<WeightPredictionResult> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const [weights, plans, meals] = await Promise.all([
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.dayPlan.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.mealLog.findMany({ where: { userId }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
  ]);
  const prediction = buildWeightPrediction({
    userId,
    currentWeight: weights[weights.length - 1]?.weight ?? user.weight,
    goalWeight: user.goalWeight,
    weightEntries: weights.map(entry => ({ date: dateToISODate(entry.date), weight: entry.weight })),
    plans: plans.map(plan => ({
      date: dateToISODate(plan.date),
      carbType: plan.carbType,
      calories: plan.calories,
      carb: plan.carb,
      protein: plan.protein,
      fat: plan.fat,
      completed: plan.completed,
      muscleGroup: parseMuscleGroup(plan.muscleGroup),
      trainingLabel: plan.trainingLabel || undefined,
    })),
    meals: meals.map(meal => ({
      id: meal.id,
      date: dateToISODate(meal.date),
      mealType: meal.mealType as MealLog['mealType'],
      description: meal.description,
      items: [],
      carb: meal.carb,
      protein: meal.protein,
      fat: meal.fat,
      calories: meal.calories ?? undefined,
      source: meal.source === 'manual' ? 'manual' : 'ai',
      createdAt: meal.createdAt.toISOString(),
      updatedAt: meal.updatedAt.toISOString(),
    })),
    horizonDays,
  });

  if (prediction.status === 'insufficient_data') return prediction;

  const saved = await prisma.weightPrediction.create({
    data: {
      userId,
      generatedAt: new Date(prediction.generatedAt),
      currentWeight: prediction.currentWeight,
      goalWeight: prediction.goalWeight,
      estimatedGoalDate: prediction.estimatedGoalDate ? toDate(prediction.estimatedGoalDate) : undefined,
      estimatedDaysToGoal: prediction.estimatedDaysToGoal,
      goalProbability: prediction.goalProbability,
      slopeKgPerDay: prediction.slopeKgPerDay,
      residualStd: prediction.residualStd,
      plateauStatus: prediction.plateau.status,
      plateauReason: prediction.plateau.reason,
      calorieDeficitSummary: prediction.calorieDeficit as unknown as Prisma.InputJsonValue,
      forecast30Days: prediction.forecast30Days as unknown as Prisma.InputJsonValue,
      modelVersion: prediction.modelVersion,
    },
  });

  return weightPredictionRecordToDto(saved);
}

export function weightPredictionRecordToDto(record: {
  id: string;
  userId: string;
  generatedAt: Date;
  currentWeight: number;
  goalWeight: number;
  estimatedGoalDate: Date | null;
  estimatedDaysToGoal: number | null;
  goalProbability: number;
  slopeKgPerDay: number;
  residualStd: number;
  plateauStatus: string;
  plateauReason: string;
  calorieDeficitSummary: unknown;
  forecast30Days: unknown;
  modelVersion: string;
}): WeightPredictionResult {
  return {
    id: record.id,
    userId: record.userId,
    generatedAt: record.generatedAt.toISOString(),
    currentWeight: record.currentWeight,
    goalWeight: record.goalWeight,
    estimatedGoalDate: record.estimatedGoalDate ? dateToISODate(record.estimatedGoalDate) : undefined,
    estimatedDaysToGoal: record.estimatedDaysToGoal ?? undefined,
    goalProbability: record.goalProbability,
    slopeKgPerDay: record.slopeKgPerDay,
    residualStd: record.residualStd,
    plateau: {
      status: record.plateauStatus === 'possible' || record.plateauStatus === 'none' ? record.plateauStatus : 'unknown',
      reason: record.plateauReason,
      daysChecked: 14,
    },
    calorieDeficit: normalizeCalorieDeficit(record.calorieDeficitSummary),
    forecast30Days: normalizeForecast(record.forecast30Days),
    modelVersion: 'linear-regression-v1',
    status: 'ready',
  };
}

function parseMuscleGroup(value: string | null): MuscleGroup | undefined {
  return value && value in muscleGroupLabels ? value as MuscleGroup : undefined;
}

function normalizeCalorieDeficit(value: unknown): CalorieDeficitSummary {
  const source = value && typeof value === 'object' ? value as Partial<CalorieDeficitSummary> : {};
  return {
    averageTargetCalories: typeof source.averageTargetCalories === 'number' ? source.averageTargetCalories : 0,
    averageActualCalories: typeof source.averageActualCalories === 'number' ? source.averageActualCalories : 0,
    averagePlanGap: typeof source.averagePlanGap === 'number' ? source.averagePlanGap : 0,
    loggedDays: typeof source.loggedDays === 'number' ? source.loggedDays : 0,
  };
}

function normalizeForecast(value: unknown): WeightPredictionPoint[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WeightPredictionPoint => (
    Boolean(item)
    && typeof item === 'object'
    && typeof (item as WeightPredictionPoint).date === 'string'
    && typeof (item as WeightPredictionPoint).predictedWeight === 'number'
    && typeof (item as WeightPredictionPoint).lowerBound === 'number'
    && typeof (item as WeightPredictionPoint).upperBound === 'number'
  ));
}
