export type CarbType = 'high' | 'mid' | 'low';
export type FatLossStrategyType = 'calorie_deficit' | 'if_16_8' | 'carb_cycling';
export type Somatotype = 'endomorph' | 'mesomorph' | 'ectomorph';
export type MuscleGroup = 'legs' | 'back' | 'chest' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'rest';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface TrainingDay {
  dayIndex: number;
  muscleGroup: MuscleGroup;
  label: string;
  cycleMode?: 'rhythm';
  trainingStreak?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  height: number;
  weight: number;
  bodyFat: number;
  trainingFrequency: number;
  trainingIntensity: 'low' | 'medium' | 'high';
  startDate: string;
  initialWeightDate?: string;
  goalWeight: number;
  somatotype: Somatotype;
  trainingSchedule: TrainingDay[];
}

export interface DayPlan {
  date: string;
  carbType: CarbType;
  calories: number;
  carb: number;
  protein: number;
  fat: number;
  completed: boolean;
  strategyId?: string;
  strategyType?: FatLossStrategyType;
  fastingWindow?: unknown;
  dayGoal?: unknown;
  muscleGroup?: MuscleGroup;
  trainingLabel?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  cards?: ChatCard[];
}

export interface ChatCard {
  type: 'food' | 'calorie' | 'suggestion';
  title: string;
  items: { label: string; value: string; emoji?: string }[];
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface FoodItem {
  name: string;
  amountText?: string;
  weightGram?: number;
  calories?: number;
  confidence?: number;
  carb: number;
  protein: number;
  fat: number;
}

export interface MealLog {
  id: string;
  date: string;
  mealType: MealType;
  description: string;
  items: FoodItem[];
  carb: number;
  protein: number;
  fat: number;
  calories?: number;
  source: 'ai' | 'manual';
  createdAt: string;
  updatedAt?: string;
}

export interface DailyReport {
  id: string;
  userId?: string;
  date: string;
  score: number;
  summary: string;
  suggestions: string[];
  readAt?: string;
  createdAt: string;
}

export interface WeeklyReportMetrics {
  startWeight?: number;
  endWeight?: number;
  weightChange?: number;
  averageCalories: number;
  averageProtein: number;
  proteinHitRate: number;
  completedDays: number;
  longestStreak: number;
  mealLoggedDays: number;
  proteinHitDays: number;
  predictionDays?: number;
  dataCompleteness: number;
}

export interface WeeklyReportRisk {
  date: string;
  type: 'binge';
  message: string;
}

export interface WeeklyReport {
  id: string;
  userId?: string;
  weekIndex: number;
  startDate: string;
  endDate: string;
  score: number;
  summary: string;
  headline?: string;
  suggestions: string[];
  metrics: WeeklyReportMetrics;
  risks: WeeklyReportRisk[];
  readAt?: string;
  createdAt: string;
}

export interface WeightPredictionPoint {
  date: string;
  predictedWeight: number;
  lowerBound: number;
  upperBound: number;
}

export interface PlateauDetection {
  status: 'none' | 'possible' | 'unknown';
  reason: string;
  daysChecked: number;
}

export interface CalorieDeficitSummary {
  averageTargetCalories: number;
  averageActualCalories: number;
  averagePlanGap: number;
  loggedDays: number;
}

export interface WeightPredictionResult {
  id?: string;
  userId: string;
  generatedAt: string;
  currentWeight: number;
  goalWeight: number;
  estimatedGoalDate?: string;
  estimatedDaysToGoal?: number;
  goalProbability: number;
  slopeKgPerDay: number;
  residualStd: number;
  plateau: PlateauDetection;
  calorieDeficit: CalorieDeficitSummary;
  forecast30Days: WeightPredictionPoint[];
  modelVersion: 'linear-regression-v1';
  status: 'ready' | 'insufficient_data';
}

export interface CoachMemory {
  id: string;
  userId: string;
  type: 'preference' | 'effective_strategy' | 'risk_pattern' | 'milestone' | 'rejected_advice';
  title: string;
  content: unknown;
  confidence: number;
  source: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CoachInsight {
  id: string;
  userId: string;
  date: string;
  type: 'daily_review' | 'weekly_review' | 'plateau' | 'adherence' | 'nutrition' | 'training' | 'motivation';
  severity: 'info' | 'warning' | 'action';
  title: string;
  summary: string;
  evidence: unknown;
  status: 'new' | 'read' | 'archived';
  createdAt: string;
}

export interface ActionProposal {
  id: string;
  userId: string;
  type: 'adjust_calorie_target' | 'adjust_carb_cycle' | 'generate_meal_plan' | 'generate_training_plan' | 'generate_shopping_list' | 'update_weight_goal' | 'update_calorie_target' | 'reorder_carb_cycle' | 'create_shopping_list';
  status: 'pending' | 'accepted' | 'edited' | 'dismissed' | 'expired';
  title: string;
  summary: string;
  payload: unknown;
  reason: unknown;
  safety: unknown;
  toolName?: string;
  executionState?: 'draft' | 'pending_confirmation' | 'executing' | 'completed' | 'failed' | 'partially_failed';
  diffPreview?: unknown;
  approvedAt?: string;
  approvedByUserId?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface MealPlanDay {
  id: string;
  userId: string;
  date: string;
  meals: unknown;
  macros: unknown;
  source: string;
  createdAt: string;
}

export interface TrainingPlanBlock {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  days: unknown;
  source: string;
  createdAt: string;
}

export interface ShoppingListPlan {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  items: unknown;
  source: string;
  createdAt: string;
}

export interface NotificationEvent {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: unknown;
  status: 'queued' | 'sent' | 'read' | 'cancelled';
  scheduledAt: string;
  sentAt?: string;
  createdAt: string;
}

export interface CoachFeed {
  insights: CoachInsight[];
  proposals: ActionProposal[];
  notifications: NotificationEvent[];
  memories: CoachMemory[];
}
