import type { ActiveStrategy, StrategyProposalDto, UserLifestyleProfile } from '@/lib/strategy-engine/types';
import { dateToISODate } from '@/lib/server-mappers';

export function lifestyleToResponse(profile: {
  userId: string;
  sleepRegularity: string;
  averageSleepHours: number | null;
  workStudyRhythm: string;
  oftenStaysUpLate: boolean;
  isStudent: boolean;
  dietRegularity: string;
  bingeRisk: string;
  takeawayFrequency: string;
  complexPlanTolerance: string;
  hasFitnessHabit: boolean;
  hasStrengthTraining: boolean;
  trainingExperience: string;
  fatLossGoal: string;
  targetWeeks: number | null;
  derivedMetrics?: unknown;
}): UserLifestyleProfile {
  return {
    userId: profile.userId,
    sleepRegularity: asEnum(profile.sleepRegularity, ['regular', 'mixed', 'irregular'], 'mixed'),
    averageSleepHours: profile.averageSleepHours ?? undefined,
    workStudyRhythm: asEnum(profile.workStudyRhythm, ['student', 'office', 'shift', 'flexible', 'high_pressure'], 'flexible'),
    oftenStaysUpLate: profile.oftenStaysUpLate,
    isStudent: profile.isStudent,
    dietRegularity: asEnum(profile.dietRegularity, ['regular', 'mixed', 'irregular'], 'mixed'),
    bingeRisk: asEnum(profile.bingeRisk, ['low', 'medium', 'high'], 'low'),
    takeawayFrequency: asEnum(profile.takeawayFrequency, ['low', 'medium', 'high'], 'medium'),
    complexPlanTolerance: asEnum(profile.complexPlanTolerance, ['low', 'medium', 'high'], 'medium'),
    hasFitnessHabit: profile.hasFitnessHabit,
    hasStrengthTraining: profile.hasStrengthTraining,
    trainingExperience: asEnum(profile.trainingExperience, ['none', 'beginner', 'intermediate', 'advanced'], 'beginner'),
    fatLossGoal: asEnum(profile.fatLossGoal, ['health', 'appearance', 'performance', 'event'], 'appearance'),
    targetWeeks: profile.targetWeeks ?? undefined,
    derivedMetrics: isRecord(profile.derivedMetrics) ? profile.derivedMetrics as unknown as UserLifestyleProfile['derivedMetrics'] : undefined,
  };
}

export function strategyToResponse(strategy: {
  id: string;
  userId: string;
  strategyType: 'calorie_deficit' | 'if_16_8' | 'carb_cycling';
  intensity: 'gentle' | 'standard' | 'aggressive';
  startDate: Date;
  tdee: number | null;
  targetCalories: number | null;
  proteinGrams: number | null;
  fastingWindow: unknown;
  carbCycleConfig: unknown;
  expectedLossKgPerWeek: number;
  stageGoal: string;
  recommendationReasons: unknown;
  scoreBreakdown: unknown;
  safetyFlags: unknown;
}): ActiveStrategy {
  return {
    id: strategy.id,
    userId: strategy.userId,
    strategyType: strategy.strategyType,
    intensity: strategy.intensity,
    startDate: dateToISODate(strategy.startDate),
    tdee: strategy.tdee ?? undefined,
    targetCalories: strategy.targetCalories ?? undefined,
    proteinGrams: strategy.proteinGrams ?? undefined,
    fastingWindow: isRecord(strategy.fastingWindow) ? strategy.fastingWindow as ActiveStrategy['fastingWindow'] : undefined,
    carbCycleConfig: isRecord(strategy.carbCycleConfig) ? strategy.carbCycleConfig as ActiveStrategy['carbCycleConfig'] : undefined,
    expectedLossKgPerWeek: strategy.expectedLossKgPerWeek,
    stageGoal: strategy.stageGoal,
    recommendationReasons: Array.isArray(strategy.recommendationReasons) ? strategy.recommendationReasons.filter(isString) : [],
    scoreBreakdown: isRecord(strategy.scoreBreakdown)
      ? strategy.scoreBreakdown as ActiveStrategy['scoreBreakdown']
      : { calorieDeficit: 0, intermittentFasting: 0, carbCycling: 0 },
    safetyFlags: Array.isArray(strategy.safetyFlags) ? strategy.safetyFlags.filter(isString) : [],
  };
}

export function strategyProposalToResponse(proposal: {
  id: string;
  title: string;
  summary: string;
  status: string;
  toStrategyType?: 'calorie_deficit' | 'if_16_8' | 'carb_cycling' | null;
  actionProposalId?: string | null;
  reason: unknown;
  diffPreview: unknown;
  createdAt: Date;
}): StrategyProposalDto {
  return {
    id: proposal.id,
    title: proposal.title,
    summary: proposal.summary,
    status: proposal.status,
    toStrategyType: proposal.toStrategyType || undefined,
    actionProposalId: proposal.actionProposalId || undefined,
    reason: proposal.reason,
    diffPreview: proposal.diffPreview,
    createdAt: proposal.createdAt.toISOString(),
  };
}

function asEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
