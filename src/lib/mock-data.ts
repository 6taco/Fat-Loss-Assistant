export type CarbType = 'high' | 'mid' | 'low';
export type Somatotype = 'endomorph' | 'mesomorph' | 'ectomorph';
export type MuscleGroup = 'legs' | 'back' | 'chest' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'rest';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface TrainingDay {
  dayIndex: number;
  muscleGroup: MuscleGroup;
  label: string;
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
  { dayIndex: 5, muscleGroup: 'arms', label: '手臂/核心' },
  { dayIndex: 6, muscleGroup: 'rest', label: '休息' },
];

export const mockUser: UserProfile = {
  id: 'user-001',
  name: 'Alex',
  gender: 'male',
  age: 25,
  height: 175,
  weight: 72,
  bodyFat: 20,
  trainingFrequency: 5,
  trainingIntensity: 'high',
  startDate: '2025-01-01',
  initialWeightDate: '2025-01-01',
  goalWeight: 67,
  somatotype: 'mesomorph',
  trainingSchedule: defaultTrainingSchedule,
};

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

function normalizeTrainingSchedule(schedule?: TrainingDay[]): TrainingDay[] {
  const input = schedule?.length ? schedule : defaultTrainingSchedule;
  return Array.from({ length: 7 }, (_, dayIndex) => {
    const day = input.find(item => item.dayIndex === dayIndex) || defaultTrainingSchedule[dayIndex];
    const label = day.label || muscleGroupLabels[day.muscleGroup] || '训练';
    return { dayIndex, muscleGroup: day.muscleGroup, label };
  });
}

function pickWeeklyCarbTypes(schedule: TrainingDay[]): CarbType[] {
  const carbTypes: CarbType[] = Array.from({ length: 7 }, () => 'mid' as CarbType);
  const used = new Set<number>();

  const highCandidates = schedule
    .filter(day => day.muscleGroup === 'legs' || day.muscleGroup === 'back')
    .sort((a, b) => (HIGH_PRIORITY[a.muscleGroup] || 99) - (HIGH_PRIORITY[b.muscleGroup] || 99) || a.dayIndex - b.dayIndex);

  for (const day of highCandidates.slice(0, 2)) {
    carbTypes[day.dayIndex] = 'high';
    used.add(day.dayIndex);
  }

  if (used.size < 2) {
    const fallbackHigh = schedule
      .filter(day => !used.has(day.dayIndex) && day.muscleGroup !== 'rest')
      .sort((a, b) => (HIGH_PRIORITY[a.muscleGroup] || 99) - (HIGH_PRIORITY[b.muscleGroup] || 99) || a.dayIndex - b.dayIndex);

    for (const day of fallbackHigh.slice(0, 2 - used.size)) {
      carbTypes[day.dayIndex] = 'high';
      used.add(day.dayIndex);
    }
  }

  const lowDays = schedule
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
  const schedule = normalizeTrainingSchedule(trainingSchedule);
  const weeklyTypes = pickWeeklyCarbTypes(schedule);
  const perKg = MACROS_PER_KG_BY_SOMATOTYPE[somatotype] || MACROS_PER_KG_BY_SOMATOTYPE.mesomorph;
  const weeklyCarb = weightKg * perKg.carb * 7;
  const weeklyFat = weightKg * perKg.fat * 7;
  const dailyProtein = weightKg * perKg.protein;
  const macroByType: Record<CarbType, { carb: number; fat: number }> = {
    high: { carb: weeklyCarb * 0.5 / 2, fat: weeklyFat * 0.15 / 2 },
    mid: { carb: weeklyCarb * 0.35 / 3, fat: weeklyFat * 0.35 / 3 },
    low: { carb: weeklyCarb * 0.15 / 2, fat: weeklyFat * 0.5 / 2 },
  };

  for (let i = 0; i < 28; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const weekDay = i % 7;
    const carbType = weeklyTypes[weekDay];
    const trainingDay = schedule[weekDay];
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

  return plans;
}

export const mockPlan = generateCarbCyclePlan(
  new Date().toISOString().slice(0, 10),
  mockUser.weight,
  mockUser.somatotype,
  mockUser.trainingSchedule,
);

export const mockWeightLog: WeightEntry[] = [
  { date: '2025-01-01', weight: 72.5 },
  { date: '2025-01-03', weight: 72.3 },
  { date: '2025-01-05', weight: 72.0 },
  { date: '2025-01-07', weight: 71.8 },
  { date: '2025-01-09', weight: 72.1 },
  { date: '2025-01-11', weight: 71.6 },
  { date: '2025-01-13', weight: 71.3 },
  { date: '2025-01-14', weight: 71.1 },
];

export const mockMealLogs: MealLog[] = [];

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

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-001',
    role: 'ai',
    content: '你好，我是 Coach Zero。完成基础信息后，我会根据你的体重、胚型和训练安排生成 232 碳循环计划。',
    timestamp: '2025-01-14T09:00:00',
  },
  {
    id: 'msg-002',
    role: 'ai',
    content: '高碳日会优先匹配背部和腿部训练，低碳日会优先匹配休息日，蛋白质每天保持一致。',
    timestamp: '2025-01-14T09:00:05',
    cards: [
      {
        type: 'suggestion',
        title: '碳循环生成规则',
        items: [
          { label: '周结构', value: '2 高碳 / 3 中碳 / 2 低碳' },
          { label: '蛋白质', value: '每天一致' },
          { label: '训练匹配', value: '背腿高碳，休息低碳' },
        ],
      },
    ],
  },
];

export function getTodayPlan(plans: DayPlan[]): DayPlan | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return plans.find(p => p.date === today) || plans[13];
}

export function getFatBurnIndex(carbType: CarbType, completed: boolean): number {
  const base: Record<CarbType, number> = { high: 72, mid: 81, low: 93 };
  return completed ? Math.min(99, base[carbType] + 5) : base[carbType];
}
