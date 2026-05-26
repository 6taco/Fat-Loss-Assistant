import type { DayPlan, MealLog, UserProfile, WeightEntry, WeightPredictionPoint } from '@/lib/mock-data';

export type DigitalTwinConfidence = 'high' | 'medium' | 'low';
export type PlateauRisk = 'low' | 'medium' | 'high' | 'unknown';
export type ScenarioType = 'maintain_current' | 'reduce_calories' | 'add_steps' | 'improve_adherence' | 'improve_protein' | 'reorder_carb_cycle';

export interface DigitalTwinDataSet {
  user: UserProfile;
  weights: WeightEntry[];
  plans: DayPlan[];
  meals: MealLog[];
  chatMessages: { role: string; content: string; createdAt?: string }[];
  agentFindings: unknown[];
  coachInsights: unknown[];
  actionProposals: { type: string; status: string; createdAt?: Date }[];
}

export interface DigitalTwinFeatures {
  confidence: DigitalTwinConfidence;
  dataQuality: {
    weightDays: number;
    mealLoggedDays: number;
    completedDays: number;
    chatMessages: number;
    predictionConfidence: DigitalTwinConfidence;
    missingSignals: string[];
  };
  persona: Record<string, unknown>;
  behaviorProfile: Record<string, unknown>;
  nutritionProfile: Record<string, unknown>;
  trainingProfile: Record<string, unknown>;
  plateauProfile: Record<string, unknown>;
  modelSummary: {
    currentWeight: number;
    goalWeight: number;
    slope7d: number;
    slope14d: number;
    slope30d: number;
    slopeKgPerDay: number;
    slopeKgPerWeek: number;
    residualStd: number;
    trendConfidence: DigitalTwinConfidence;
    plateauRisk: PlateauRisk;
    explanation: string;
  };
}

export interface DigitalTwinForecastPoint extends WeightPredictionPoint {
  scenarioWeight?: number;
}

export interface DigitalTwinPredictionDto {
  id?: string;
  horizonDays: number;
  currentWeight: number;
  predictedWeight?: number;
  goalProbability: number;
  slopeKgPerDay: number;
  plateauRisk: PlateauRisk;
  forecast: DigitalTwinForecastPoint[];
  assumptions: Record<string, unknown>;
  confidence: DigitalTwinConfidence;
  modelVersion: 'digital-twin-v1';
}

export interface ScenarioInput {
  type: ScenarioType;
  horizonDays?: number;
  dailyCalorieDelta?: number;
  dailyStepsAdded?: number;
  adherenceBoost?: number;
  proteinHitRateBoost?: number;
}

export interface DigitalTwinScenarioDto {
  id?: string;
  type: ScenarioType;
  title: string;
  assumptions: Record<string, unknown>;
  result?: {
    predictedWeight?: number;
    deltaVsBaseline?: number;
    range?: [number, number];
    explanation: string;
    forecast: DigitalTwinForecastPoint[];
  };
  status: 'completed' | 'failed';
}

export interface DigitalTwinProfileDto {
  id?: string;
  userId: string;
  version: 'digital-twin-v1';
  generatedAt: string;
  dataStartDate?: string;
  dataEndDate?: string;
  dataQuality: DigitalTwinFeatures['dataQuality'];
  persona: DigitalTwinFeatures['persona'];
  behaviorProfile: DigitalTwinFeatures['behaviorProfile'];
  nutritionProfile: DigitalTwinFeatures['nutritionProfile'];
  trainingProfile: DigitalTwinFeatures['trainingProfile'];
  plateauProfile: DigitalTwinFeatures['plateauProfile'];
  modelSummary: DigitalTwinFeatures['modelSummary'];
  confidence: DigitalTwinConfidence;
}

export interface DigitalTwinBundle {
  profile: DigitalTwinProfileDto;
  prediction: DigitalTwinPredictionDto;
  scenarios: DigitalTwinScenarioDto[];
}
