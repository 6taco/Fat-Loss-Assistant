import {
  ChatMessage,
  DayPlan,
  defaultTrainingSchedule,
  type FoodItem,
  MealLog,
  type MealType,
  type MuscleGroup,
  type Somatotype,
  type TrainingDay,
  UserProfile,
  WeightEntry,
  muscleGroupLabels,
} from '@/lib/mock-data';

export function toDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

export function dateToISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function userToResponse(user: {
  id: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  height: number;
  weight: number;
  bodyFat: number;
  trainingFrequency: number;
  trainingIntensity: 'low' | 'medium' | 'high';
  startDate: Date;
  initialWeightDate: Date | null;
  goalWeight: number;
  somatotype?: string;
  trainingSchedule?: unknown;
}): UserProfile {
  return {
    id: user.id,
    name: user.name,
    gender: user.gender,
    age: user.age,
    height: user.height,
    weight: user.weight,
    bodyFat: user.bodyFat,
    trainingFrequency: user.trainingFrequency,
    trainingIntensity: user.trainingIntensity,
    startDate: dateToISODate(user.startDate),
    initialWeightDate: user.initialWeightDate ? dateToISODate(user.initialWeightDate) : undefined,
    goalWeight: user.goalWeight,
    somatotype: toSomatotype(user.somatotype),
    trainingSchedule: toTrainingSchedule(user.trainingSchedule),
  };
}

export function dayPlanToResponse(plan: {
  date: Date;
  carbType: 'high' | 'mid' | 'low';
  calories: number;
  carb: number;
  protein: number;
  fat: number;
  completed: boolean;
  muscleGroup?: string | null;
  trainingLabel?: string | null;
}): DayPlan {
  return {
    date: dateToISODate(plan.date),
    carbType: plan.carbType,
    calories: plan.calories,
    carb: plan.carb,
    protein: plan.protein,
    fat: plan.fat,
    completed: plan.completed,
    muscleGroup: toMuscleGroup(plan.muscleGroup),
    trainingLabel: plan.trainingLabel || undefined,
  };
}

function toSomatotype(value: unknown): Somatotype {
  return value === 'endomorph' || value === 'ectomorph' || value === 'mesomorph' ? value : 'mesomorph';
}

function toMuscleGroup(value: unknown): MuscleGroup | undefined {
  if (
    value === 'legs' ||
    value === 'back' ||
    value === 'chest' ||
    value === 'shoulders' ||
    value === 'arms' ||
    value === 'core' ||
    value === 'cardio' ||
    value === 'rest'
  ) {
    return value;
  }
  return undefined;
}

function toTrainingSchedule(value: unknown): TrainingDay[] {
  if (!Array.isArray(value)) return defaultTrainingSchedule;

  const schedule = value
    .map((item, dayIndex) => {
      if (!item || typeof item !== 'object') return null;
      const source = item as { muscleGroup?: unknown; label?: unknown };
      const muscleGroup = toMuscleGroup(source.muscleGroup);
      if (!muscleGroup) return null;
      return {
        dayIndex,
        muscleGroup,
        label: typeof source.label === 'string' ? source.label : muscleGroupLabels[muscleGroup],
      };
    })
    .filter((item): item is TrainingDay => Boolean(item));

  const hasTraining = schedule.some(day => day.muscleGroup !== 'rest');
  const hasRest = schedule.some(day => day.muscleGroup === 'rest');
  return hasTraining && hasRest ? schedule : defaultTrainingSchedule;
}

export function weightToResponse(entry: { date: Date; weight: number }): WeightEntry {
  return {
    date: dateToISODate(entry.date),
    weight: entry.weight,
  };
}

export function chatToResponse(message: {
  id: string;
  role: 'user' | 'ai';
  content: string;
  cards: unknown;
  createdAt: Date;
}): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.createdAt.toISOString(),
    cards: Array.isArray(message.cards) ? message.cards as ChatMessage['cards'] : undefined,
  };
}

export function mealLogToResponse(meal: {
  id: string;
  date: Date;
  mealType: string;
  description: string;
  items: unknown;
  carb: number;
  protein: number;
  fat: number;
  calories: number | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}): MealLog {
  return {
    id: meal.id,
    date: dateToISODate(meal.date),
    mealType: toMealType(meal.mealType),
    description: meal.description,
    items: toFoodItems(meal.items),
    carb: meal.carb,
    protein: meal.protein,
    fat: meal.fat,
    calories: meal.calories ?? undefined,
    source: meal.source === 'manual' ? 'manual' : 'ai',
    createdAt: meal.createdAt.toISOString(),
    updatedAt: meal.updatedAt.toISOString(),
  };
}

function toMealType(value: unknown): MealType {
  if (value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack') return value;
  return 'breakfast';
}

function toFoodItems(value: unknown): FoodItem[] {
  if (!Array.isArray(value)) return [];

  const items: FoodItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const source = item as { name?: unknown; amountText?: unknown; carb?: unknown; protein?: unknown; fat?: unknown };
    if (typeof source.name !== 'string') continue;
    items.push({
      name: source.name,
      ...(typeof source.amountText === 'string' ? { amountText: source.amountText } : {}),
      carb: typeof source.carb === 'number' ? source.carb : 0,
      protein: typeof source.protein === 'number' ? source.protein : 0,
      fat: typeof source.fat === 'number' ? source.fat : 0,
    });
  }
  return items;
}
