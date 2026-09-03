import type {
  CarbType,
  DayPlan,
  MealLog,
  MealType,
  MuscleGroup,
  Somatotype,
  TrainingDay,
} from '@/lib/types';

export const carbColors: Record<CarbType, { main: string; bg: string; label: string; emoji: string }> = {
  high: { main: '#FF453A', bg: 'rgba(255,69,58,0.10)', label: '高碳日', emoji: 'H' },
  mid: { main: '#FFD60A', bg: 'rgba(255,214,10,0.10)', label: '中碳日', emoji: 'M' },
  low: { main: '#30D158', bg: 'rgba(48,209,88,0.10)', label: '低碳日', emoji: 'L' },
};

export const somatotypeLabels: Record<Somatotype, string> = {
  endomorph: '内胚型',
  mesomorph: '中胚型',
  ectomorph: '外胚型',
};

export const muscleGroupLabels: Record<MuscleGroup, string> = {
  legs: '练腿',
  back: '练背',
  chest: '练胸',
  shoulders: '练肩',
  arms: '手臂',
  core: '核心',
  cardio: '有氧',
  rest: '休息',
};

export const mealTypeLabels: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

export const defaultTrainingSchedule: TrainingDay[] = [
  { dayIndex: 0, muscleGroup: 'chest', label: '练胸' },
  { dayIndex: 1, muscleGroup: 'back', label: '练背' },
  { dayIndex: 2, muscleGroup: 'rest', label: '休息' },
  { dayIndex: 3, muscleGroup: 'shoulders', label: '练肩' },
  { dayIndex: 4, muscleGroup: 'legs', label: '练腿' },
  { dayIndex: 5, muscleGroup: 'rest', label: '休息' },
  { dayIndex: 6, muscleGroup: 'arms', label: '手臂' },
  { dayIndex: 7, muscleGroup: 'core', label: '核心' },
  { dayIndex: 8, muscleGroup: 'rest', label: '休息' },
];

const MACROS_PER_KG_BY_SOMATOTYPE: Record<Somatotype, { carb: number; protein: number; fat: number }> = {
  endomorph: { carb: 2.0, protein: 1.5, fat: 0.8 },
  mesomorph: { carb: 2.5, protein: 1.5, fat: 1.0 },
  ectomorph: { carb: 3.0, protein: 1.5, fat: 1.1 },
};

const HIGH_PRIORITY: Partial<Record<MuscleGroup, number>> = {
  legs: 1,
  back: 2,
  chest: 3,
  shoulders: 4,
  arms: 5,
  core: 6,
  cardio: 7,
};

const LOW_PRIORITY: Partial<Record<MuscleGroup, number>> = {
  rest: 1,
  cardio: 2,
  core: 3,
  arms: 4,
  shoulders: 5,
  chest: 6,
  back: 7,
  legs: 8,
};

const DEFAULT_MUSCLE_ROTATION: MuscleGroup[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];

export function buildTrainingCycleByFrequency(frequency: number): TrainingDay[] {
  const trainingStreak = Math.max(1, Math.min(6, Math.round(frequency) || 3));
  const days: TrainingDay[] = [];

  for (let trainingIndex = 0; trainingIndex < DEFAULT_MUSCLE_ROTATION.length; trainingIndex++) {
    if (trainingIndex > 0 && trainingIndex % trainingStreak === 0) {
      days.push({
        dayIndex: days.length,
        muscleGroup: 'rest',
        label: muscleGroupLabels.rest,
        cycleMode: 'rhythm',
        trainingStreak,
      });
    }

    const muscleGroup = DEFAULT_MUSCLE_ROTATION[trainingIndex % DEFAULT_MUSCLE_ROTATION.length];
    days.push({
      dayIndex: days.length,
      muscleGroup,
      label: muscleGroupLabels[muscleGroup],
      cycleMode: 'rhythm',
      trainingStreak,
    });
  }

  if (DEFAULT_MUSCLE_ROTATION.length % trainingStreak === 0) {
    days.push({
      dayIndex: days.length,
      muscleGroup: 'rest',
      label: muscleGroupLabels.rest,
      cycleMode: 'rhythm',
      trainingStreak,
    });
  }

  return days;
}

export function normalizeTrainingCycle(cycle?: TrainingDay[]): TrainingDay[] {
  if (!Array.isArray(cycle) || cycle.length === 0) return defaultTrainingSchedule;

  const normalized = cycle
    .map((day, dayIndex) => {
      const muscleGroup = day?.muscleGroup;
      if (!muscleGroup || !(muscleGroup in muscleGroupLabels)) return null;
      return {
        dayIndex,
        muscleGroup,
        label: day.label || muscleGroupLabels[muscleGroup],
        ...(day.cycleMode === 'rhythm' ? { cycleMode: 'rhythm' as const } : {}),
        ...(typeof day.trainingStreak === 'number' && Number.isFinite(day.trainingStreak)
          ? { trainingStreak: Math.max(1, Math.min(6, Math.round(day.trainingStreak))) }
          : {}),
      };
    })
    .filter((day): day is TrainingDay => Boolean(day));

  const hasTraining = normalized.some(day => day.muscleGroup !== 'rest');
  const hasRest = normalized.some(day => day.muscleGroup === 'rest');
  return hasTraining && hasRest ? normalized : defaultTrainingSchedule;
}

function toExplicitTrainingCycle(cycle: TrainingDay[]) {
  return cycle.map((day, dayIndex) => ({
    dayIndex,
    muscleGroup: day.muscleGroup,
    label: day.label || muscleGroupLabels[day.muscleGroup],
  }));
}

export function appendTrainingCycleDay(cycle: TrainingDay[]): TrainingDay[] {
  const explicitCycle = toExplicitTrainingCycle(cycle);
  if (explicitCycle.length >= 14) return explicitCycle;
  return [
    ...explicitCycle,
    {
      dayIndex: explicitCycle.length,
      muscleGroup: 'rest',
      label: muscleGroupLabels.rest,
    },
  ];
}

export function removeLastTrainingCycleDay(cycle: TrainingDay[]): TrainingDay[] {
  const explicitCycle = toExplicitTrainingCycle(cycle);
  if (explicitCycle.length <= 2) return explicitCycle;
  return explicitCycle.slice(0, -1);
}

export function updateTrainingCycleDay(cycle: TrainingDay[], dayIndex: number, muscleGroup: MuscleGroup): TrainingDay[] {
  return toExplicitTrainingCycle(cycle).map(day => day.dayIndex === dayIndex
    ? { ...day, muscleGroup, label: muscleGroupLabels[muscleGroup] }
    : day);
}

export function getPlanWeek(plans: DayPlan[], currentDate = new Date().toISOString().slice(0, 10)) {
  const sortedPlans = [...plans].sort((a, b) => a.date.localeCompare(b.date));
  if (!sortedPlans.length) return { plans: [], weekNumber: 0, startIndex: 0 };

  const currentIndex = sortedPlans.findIndex(plan => plan.date >= currentDate);
  const anchorIndex = currentIndex === -1 ? sortedPlans.length - 1 : currentIndex;
  const startIndex = Math.floor(anchorIndex / 7) * 7;

  return {
    plans: sortedPlans.slice(startIndex, startIndex + 7),
    weekNumber: Math.floor(startIndex / 7) + 1,
    startIndex,
  };
}

function getCycleRhythm(cycle: TrainingDay[]) {
  const rhythmDay = cycle.find(day => day.cycleMode === 'rhythm' && day.trainingStreak);
  if (!rhythmDay?.trainingStreak) return null;

  const trainingStreak = Math.max(1, Math.min(6, rhythmDay.trainingStreak));
  const cadenceLength = trainingStreak + 1;
  const matchesGeneratedCadence = cycle.every((day, dayIndex) => {
    const shouldRest = dayIndex % cadenceLength === trainingStreak;
    return shouldRest ? day.muscleGroup === 'rest' : day.muscleGroup !== 'rest';
  });
  if (!matchesGeneratedCadence) return null;

  const rotation = cycle.filter(day => day.muscleGroup !== 'rest').map(day => day.muscleGroup);
  if (rotation.length === 0) return null;

  return {
    trainingStreak,
    rotation,
  };
}

export function getTrainingDayForDateOffset(cycle: TrainingDay[], offset: number): TrainingDay {
  const normalizedCycle = normalizeTrainingCycle(cycle);
  const rhythm = getCycleRhythm(normalizedCycle);

  if (rhythm) {
    const cadenceLength = rhythm.trainingStreak + 1;
    if (offset % cadenceLength === rhythm.trainingStreak) {
      return {
        dayIndex: offset,
        muscleGroup: 'rest',
        label: muscleGroupLabels.rest,
      };
    }

    const restDaysBeforeOrAtOffset = Math.floor((offset + 1) / cadenceLength);
    const trainingIndex = offset - restDaysBeforeOrAtOffset;
    const muscleGroup = rhythm.rotation[trainingIndex % rhythm.rotation.length];
    return {
      dayIndex: offset,
      muscleGroup,
      label: muscleGroupLabels[muscleGroup],
    };
  }

  const cycleIndex = offset % normalizedCycle.length;
  const day = normalizedCycle[cycleIndex];
  return {
    dayIndex: offset,
    muscleGroup: day.muscleGroup,
    label: day.label,
  };
}

export function pickCarbTypesForSevenDayBlock(blockTrainingDays: TrainingDay[]): CarbType[] {
  const carbTypes: CarbType[] = Array.from({ length: blockTrainingDays.length }, () => 'mid' as CarbType);
  const used = new Set<number>();

  const highCandidates = blockTrainingDays
    .filter(day => day.muscleGroup === 'legs' || day.muscleGroup === 'back')
    .sort((a, b) => (HIGH_PRIORITY[a.muscleGroup] || 99) - (HIGH_PRIORITY[b.muscleGroup] || 99) || a.dayIndex - b.dayIndex);

  for (const day of highCandidates.slice(0, 2)) {
    carbTypes[day.dayIndex] = 'high';
    used.add(day.dayIndex);
  }

  if (used.size < 2) {
    const fallbackHigh = blockTrainingDays
      .filter(day => !used.has(day.dayIndex) && day.muscleGroup !== 'rest')
      .sort((a, b) => (HIGH_PRIORITY[a.muscleGroup] || 99) - (HIGH_PRIORITY[b.muscleGroup] || 99) || a.dayIndex - b.dayIndex);

    for (const day of fallbackHigh.slice(0, 2 - used.size)) {
      carbTypes[day.dayIndex] = 'high';
      used.add(day.dayIndex);
    }
  }

  if (used.size < 2) {
    const remainingHigh = blockTrainingDays
      .filter(day => !used.has(day.dayIndex))
      .sort((a, b) => (HIGH_PRIORITY[a.muscleGroup] || 99) - (HIGH_PRIORITY[b.muscleGroup] || 99) || a.dayIndex - b.dayIndex);

    for (const day of remainingHigh.slice(0, 2 - used.size)) {
      carbTypes[day.dayIndex] = 'high';
      used.add(day.dayIndex);
    }
  }

  const lowDays = blockTrainingDays
    .filter(day => !used.has(day.dayIndex))
    .sort((a, b) => (LOW_PRIORITY[a.muscleGroup] || 99) - (LOW_PRIORITY[b.muscleGroup] || 99) || b.dayIndex - a.dayIndex)
    .slice(0, 2);

  for (const day of lowDays) {
    carbTypes[day.dayIndex] = 'low';
    used.add(day.dayIndex);
  }

  return carbTypes;
}

export function generateCarbCyclePlan(
  startDate: string,
  weightKg: number,
  somatotype: Somatotype = 'mesomorph',
  trainingSchedule: TrainingDay[] = defaultTrainingSchedule,
): DayPlan[] {
  const plans: DayPlan[] = [];
  const start = new Date(startDate);
  const cycle = normalizeTrainingCycle(trainingSchedule);
  const perKg = MACROS_PER_KG_BY_SOMATOTYPE[somatotype] || MACROS_PER_KG_BY_SOMATOTYPE.mesomorph;
  const weeklyCarb = weightKg * perKg.carb * 7;
  const weeklyFat = weightKg * perKg.fat * 7;
  const dailyProtein = weightKg * perKg.protein;
  const macroByType: Record<CarbType, { carb: number; fat: number }> = {
    high: { carb: weeklyCarb * 0.5 / 2, fat: weeklyFat * 0.15 / 2 },
    mid: { carb: weeklyCarb * 0.35 / 3, fat: weeklyFat * 0.35 / 3 },
    low: { carb: weeklyCarb * 0.15 / 2, fat: weeklyFat * 0.5 / 2 },
  };

  for (let blockStart = 0; blockStart < 28; blockStart += 7) {
    const blockTrainingDays = Array.from({ length: 7 }, (_, blockOffset) => ({
      ...getTrainingDayForDateOffset(cycle, blockStart + blockOffset),
      dayIndex: blockOffset,
    }));
    const blockCarbTypes = pickCarbTypesForSevenDayBlock(blockTrainingDays);

    for (let blockOffset = 0; blockOffset < 7; blockOffset++) {
      const dayOffset = blockStart + blockOffset;
      const d = new Date(start);
      d.setDate(d.getDate() + dayOffset);
      const carbType = blockCarbTypes[blockOffset];
      const trainingDay = blockTrainingDays[blockOffset];
      const carb = Math.round(macroByType[carbType].carb);
      const protein = Math.round(dailyProtein);
      const fat = Math.round(macroByType[carbType].fat);
      const calories = carb * 4 + protein * 4 + fat * 9;

      plans.push({
        date: d.toISOString().slice(0, 10),
        carbType,
        calories,
        carb,
        protein,
        fat,
        completed: false,
        muscleGroup: trainingDay.muscleGroup,
        trainingLabel: trainingDay.label,
      });
    }
  }

  return plans;
}

export function calculateMealCalories(meal: Pick<MealLog, 'carb' | 'protein' | 'fat'>): number {
  return Math.round(meal.carb * 4 + meal.protein * 4 + meal.fat * 9);
}

export function sumMealMacros(meals: MealLog[]) {
  return meals.reduce(
    (sum, meal) => ({
      carb: sum.carb + meal.carb,
      protein: sum.protein + meal.protein,
      fat: sum.fat + meal.fat,
      calories: sum.calories + (meal.calories ?? calculateMealCalories(meal)),
    }),
    { carb: 0, protein: 0, fat: 0, calories: 0 },
  );
}

export const aiTips: Record<CarbType, string> = {
  high: '今天是高碳日，优先安排背部或腿部训练，训练前后补足复合碳水。',
  mid: '今天是中碳日，适合胸、肩、手臂或核心训练，保持蛋白质稳定。',
  low: '今天是低碳日，更适合作为休息日，脂肪目标相对更高，注意补水和蔬菜。',
};

export const aiAnalysis: Record<CarbType, string> = {
  high: 'AI 分析：高碳日用于支撑大肌群训练和糖原补充。',
  mid: 'AI 分析：中碳日用于维持训练质量和恢复节奏。',
  low: 'AI 分析：低碳日用于休息恢复和控制周碳水总量。',
};

export function getTodayPlan(plans: DayPlan[]): DayPlan | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return plans.find(p => p.date === today) || plans[13];
}

export function getFatBurnIndex(carbType: CarbType, completed: boolean): number {
  const base: Record<CarbType, number> = { high: 72, mid: 81, low: 93 };
  return completed ? Math.min(99, base[carbType] + 5) : base[carbType];
}
