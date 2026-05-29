import type { DayPlan, MealLog, UserProfile, WeightEntry } from '@/lib/mock-data';

export type FatLossStrategyType = 'calorie_deficit' | 'if_16_8' | 'carb_cycling';
export type StrategyIntensity = 'gentle' | 'standard' | 'aggressive';
export type StrategyConfidence = 'high' | 'medium' | 'low';

export interface UserLifestyleProfile {
  userId: string;
  sleepRegularity: 'regular' | 'mixed' | 'irregular';
  averageSleepHours?: number;
  workStudyRhythm: 'student' | 'office' | 'shift' | 'flexible' | 'high_pressure';
  oftenStaysUpLate: boolean;
  isStudent: boolean;
  dietRegularity: 'regular' | 'mixed' | 'irregular';
  bingeRisk: 'low' | 'medium' | 'high';
  takeawayFrequency: 'low' | 'medium' | 'high';
  complexPlanTolerance: 'low' | 'medium' | 'high';
  hasFitnessHabit: boolean;
  hasStrengthTraining: boolean;
  trainingExperience: 'none' | 'beginner' | 'intermediate' | 'advanced';
  fatLossGoal: 'health' | 'appearance' | 'performance' | 'event';
  targetWeeks?: number;
  derivedMetrics?: StrategyDerivedMetrics;
}

export interface StrategyDerivedMetrics {
  bmi: number;
  bmr: number;
  tdee: number;
  adherenceScore: number;
  restrictionRisk: number;
  trainingReadiness: number;
  strategyComplexityTolerance: number;
  userSegment: 'L1_beginner_low_friction' | 'L2_chaotic_rhythm' | 'L3_training_driven' | 'L4_risk_recovery';
}

export interface StrategyContext {
  user: UserProfile;
  lifestyle?: Partial<UserLifestyleProfile>;
  plans?: DayPlan[];
  meals?: MealLog[];
  weights?: WeightEntry[];
  date?: string;
}

export interface StrategyRecommendation {
  strategyType: FatLossStrategyType;
  intensity: StrategyIntensity;
  confidence: StrategyConfidence;
  scores: {
    calorieDeficit: number;
    intermittentFasting: number;
    carbCycling: number;
  };
  reasons: string[];
  whyNot: Record<FatLossStrategyType, string>;
  expectedWeightLossKgPerWeek: number;
  stageGoal: string;
  safetyFlags: string[];
  generatedPlanPreview: DayPlan[];
  derivedMetrics: StrategyDerivedMetrics;
  targets: StrategyTargets;
  userFacingMessage: string;
}

export interface StrategyTargets {
  tdee: number;
  targetCalories: number;
  proteinGrams: number;
  fastingWindow?: {
    start: string;
    end: string;
    fastingHours: number;
    eatingHours: number;
  };
  carbCycleConfig?: {
    highDays: number;
    midDays: number;
    lowDays: number;
  };
}

export interface StrategyCurrentResponse {
  strategy: ActiveStrategy | null;
  recommendation: StrategyRecommendation;
  todayPlan?: DayPlan;
  executionRate: number;
  adjustmentProposals: StrategyProposalDto[];
  source: 'db' | 'computed' | 'local';
}

export interface ActiveStrategy {
  id: string;
  userId: string;
  strategyType: FatLossStrategyType;
  intensity: StrategyIntensity;
  startDate: string;
  tdee?: number;
  targetCalories?: number;
  proteinGrams?: number;
  fastingWindow?: StrategyTargets['fastingWindow'];
  carbCycleConfig?: StrategyTargets['carbCycleConfig'];
  expectedLossKgPerWeek: number;
  stageGoal: string;
  recommendationReasons: string[];
  scoreBreakdown: StrategyRecommendation['scores'];
  safetyFlags: string[];
}

export interface StrategyProposalDto {
  id: string;
  title: string;
  summary: string;
  status: string;
  toStrategyType?: FatLossStrategyType;
  actionProposalId?: string;
  reason: unknown;
  diffPreview: unknown;
  createdAt: string;
}
