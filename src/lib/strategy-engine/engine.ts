import {
  generateCarbCyclePlan,
  getTrainingDayForDateOffset,
  normalizeTrainingCycle,
  type CarbType,
  type DayPlan,
  type TrainingDay,
} from '@/lib/mock-data';
import type {
  FatLossStrategyType,
  StrategyContext,
  StrategyDerivedMetrics,
  StrategyIntensity,
  StrategyRecommendation,
  StrategyTargets,
  UserLifestyleProfile,
} from '@/lib/strategy-engine/types';

const DEFAULT_LIFESTYLE: Omit<UserLifestyleProfile, 'userId'> = {
  sleepRegularity: 'mixed',
  averageSleepHours: 7,
  workStudyRhythm: 'flexible',
  oftenStaysUpLate: false,
  isStudent: false,
  dietRegularity: 'mixed',
  bingeRisk: 'low',
  takeawayFrequency: 'medium',
  complexPlanTolerance: 'medium',
  hasFitnessHabit: true,
  hasStrengthTraining: true,
  trainingExperience: 'beginner',
  fatLossGoal: 'appearance',
  targetWeeks: 12,
};

export const STRATEGY_LABELS: Record<FatLossStrategyType, string> = {
  calorie_deficit: '热量缺口',
  if_16_8: '16+8 轻断食',
  carb_cycling: '碳循环',
};

export function recommendFatLossStrategy(context: StrategyContext): StrategyRecommendation {
  const date = context.date || today();
  const lifestyle = normalizeLifestyle(context.user.id, context.lifestyle);
  const derivedMetrics = deriveStrategyMetrics(context, lifestyle);
  const scores = scoreStrategies(context, lifestyle, derivedMetrics);
  const strategyType = pickStrategy(scores);
  const intensity = pickIntensity(strategyType, lifestyle, derivedMetrics);
  const targets = buildStrategyTargets(context, lifestyle, derivedMetrics, strategyType, intensity);
  const generatedPlanPreview = generateStrategyDayPlans({
    strategyType,
    intensity,
    startDate: date,
    user: context.user,
    targets,
    trainingSchedule: context.user.trainingSchedule,
  }).slice(0, 28);
  const reasons = buildReasons(strategyType, context, lifestyle, derivedMetrics);
  const safetyFlags = buildSafetyFlags(context, lifestyle, derivedMetrics, intensity);
  const expectedWeightLossKgPerWeek = estimateWeeklyLoss(targets.tdee, targets.targetCalories, safetyFlags);

  return {
    strategyType,
    intensity,
    confidence: getConfidence(scores),
    scores,
    reasons,
    whyNot: buildWhyNot(strategyType, context, lifestyle),
    expectedWeightLossKgPerWeek,
    stageGoal: buildStageGoal(strategyType, intensity, expectedWeightLossKgPerWeek),
    safetyFlags,
    generatedPlanPreview,
    derivedMetrics,
    targets,
    userFacingMessage: buildUserFacingMessage(strategyType, reasons),
  };
}

export function deriveStrategyMetrics(context: StrategyContext, lifestyleInput?: Partial<UserLifestyleProfile>): StrategyDerivedMetrics {
  const user = context.user;
  const lifestyle = normalizeLifestyle(user.id, lifestyleInput);
  const bmi = round1(user.weight / ((user.height / 100) ** 2));
  // Mifflin-St Jeor resting energy equation.
  const bmr = Math.round((10 * user.weight) + (6.25 * user.height) - (5 * user.age) + (user.gender === 'male' ? 5 : -161));
  const tdee = Math.round(bmr * activityFactor(user.trainingFrequency));
  const adherenceScore = calculateAdherenceScore(context);
  const restrictionRisk = clamp(
    (lifestyle.bingeRisk === 'high' ? 40 : lifestyle.bingeRisk === 'medium' ? 20 : 5)
    + (lifestyle.oftenStaysUpLate ? 18 : 0)
    + (lifestyle.sleepRegularity === 'irregular' ? 14 : 0)
    + (adherenceScore < 50 ? 18 : 0),
    0,
    100,
  );
  const trainingReadiness = clamp(
    user.trainingFrequency * 12
    + (lifestyle.hasStrengthTraining ? 20 : 0)
    + (lifestyle.trainingExperience === 'advanced' ? 20 : lifestyle.trainingExperience === 'intermediate' ? 14 : lifestyle.trainingExperience === 'beginner' ? 6 : 0),
    0,
    100,
  );
  const strategyComplexityTolerance = clamp(
    (lifestyle.complexPlanTolerance === 'high' ? 70 : lifestyle.complexPlanTolerance === 'medium' ? 45 : 20)
    + (adherenceScore >= 70 ? 20 : adherenceScore >= 50 ? 10 : 0),
    0,
    100,
  );

  return {
    bmi,
    bmr,
    tdee,
    adherenceScore,
    restrictionRisk,
    trainingReadiness,
    strategyComplexityTolerance,
    userSegment: getUserSegment(lifestyle, trainingReadiness, restrictionRisk),
  };
}

export function generateStrategyDayPlans(input: {
  strategyType: FatLossStrategyType;
  intensity: StrategyIntensity;
  startDate: string;
  user: StrategyContext['user'];
  targets: StrategyTargets;
  trainingSchedule?: TrainingDay[];
  strategyId?: string;
}): DayPlan[] {
  if (input.strategyType === 'carb_cycling') {
    return generateCarbCyclePlan(input.startDate, input.user.weight, input.user.somatotype, input.trainingSchedule)
      .map(plan => decoratePlan(plan, input.strategyType, input.strategyId, input.targets));
  }

  const plans: DayPlan[] = [];
  const start = new Date(`${input.startDate}T00:00:00`);
  const schedule = normalizeTrainingCycle(input.trainingSchedule);
  for (let offset = 0; offset < 28; offset += 1) {
    const date = new Date(start);
    date.setDate(date.getDate() + offset);
    const trainingDay = getTrainingDayForDateOffset(schedule, offset);
    const calories = input.targets.targetCalories;
    const protein = input.targets.proteinGrams;
    const fat = Math.max(35, Math.round((calories * 0.28) / 9));
    const carb = Math.max(60, Math.round((calories - protein * 4 - fat * 9) / 4));
    const plan: DayPlan = {
      date: date.toISOString().slice(0, 10),
      carbType: getProxyCarbType(input.strategyType, offset, trainingDay),
      calories,
      carb,
      protein,
      fat,
      completed: false,
      muscleGroup: trainingDay.muscleGroup,
      trainingLabel: input.strategyType === 'if_16_8'
        ? `${input.targets.fastingWindow?.start || '12:00'}-${input.targets.fastingWindow?.end || '20:00'}`
        : trainingDay.label,
      strategyType: input.strategyType,
      strategyId: input.strategyId,
      fastingWindow: input.strategyType === 'if_16_8' ? input.targets.fastingWindow : undefined,
      dayGoal: {
        strategyType: input.strategyType,
        intensity: input.intensity,
        focus: input.strategyType === 'if_16_8' ? 'fasting_window_and_protein' : 'calorie_and_protein',
      },
    };
    plans.push(plan);
  }
  return plans;
}

export function normalizeLifestyle(userId: string, input?: Partial<UserLifestyleProfile>): UserLifestyleProfile {
  return {
    userId,
    ...DEFAULT_LIFESTYLE,
    ...input,
  };
}

function scoreStrategies(context: StrategyContext, lifestyle: UserLifestyleProfile, metrics: StrategyDerivedMetrics) {
  let calorieDeficit = 54;
  let intermittentFasting = 38;
  let carbCycling = 24;

  if (context.user.trainingFrequency <= 2) calorieDeficit += 18;
  if (metrics.bmi >= 24) calorieDeficit += 8;
  if (metrics.adherenceScore >= 55) calorieDeficit += 8;
  if (lifestyle.trainingExperience === 'none') calorieDeficit += 12;

  if (lifestyle.isStudent || lifestyle.workStudyRhythm === 'office') intermittentFasting += 12;
  if (lifestyle.oftenStaysUpLate || lifestyle.sleepRegularity === 'irregular') intermittentFasting += 16;
  if (lifestyle.dietRegularity === 'irregular') intermittentFasting += 14;
  if (lifestyle.complexPlanTolerance === 'low') intermittentFasting += 14;
  if (lifestyle.takeawayFrequency === 'high') intermittentFasting += 6;

  if (context.user.trainingFrequency >= 3) carbCycling += 22;
  if (lifestyle.hasStrengthTraining) carbCycling += 22;
  if (metrics.trainingReadiness >= 60) carbCycling += 14;
  if (metrics.strategyComplexityTolerance >= 65) carbCycling += 14;

  if (lifestyle.bingeRisk === 'high') {
    intermittentFasting -= 8;
    carbCycling -= 18;
    calorieDeficit -= 6;
  }
  if (metrics.restrictionRisk >= 60) {
    carbCycling -= 18;
  }
  if (context.user.trainingFrequency < 3 || !lifestyle.hasStrengthTraining) {
    carbCycling = Math.min(carbCycling, 45);
  }

  return {
    calorieDeficit: clamp(Math.round(calorieDeficit), 0, 100),
    intermittentFasting: clamp(Math.round(intermittentFasting), 0, 100),
    carbCycling: clamp(Math.round(carbCycling), 0, 100),
  };
}

function pickStrategy(scores: StrategyRecommendation['scores']): FatLossStrategyType {
  const entries: [FatLossStrategyType, number][] = [
    ['calorie_deficit', scores.calorieDeficit],
    ['if_16_8', scores.intermittentFasting],
    ['carb_cycling', scores.carbCycling],
  ];
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function pickIntensity(strategyType: FatLossStrategyType, lifestyle: UserLifestyleProfile, metrics: StrategyDerivedMetrics): StrategyIntensity {
  if (metrics.restrictionRisk >= 55 || lifestyle.bingeRisk === 'high' || metrics.bmi < 21) return 'gentle';
  if (strategyType === 'carb_cycling' && metrics.trainingReadiness >= 75 && metrics.adherenceScore >= 70) return 'standard';
  if (metrics.bmi >= 28 && metrics.restrictionRisk < 35 && metrics.adherenceScore >= 60) return 'aggressive';
  return 'standard';
}

function buildStrategyTargets(
  context: StrategyContext,
  lifestyle: UserLifestyleProfile,
  metrics: StrategyDerivedMetrics,
  strategyType: FatLossStrategyType,
  intensity: StrategyIntensity,
): StrategyTargets {
  const deficit = calculateEvidenceBasedDailyDeficit(context, lifestyle, metrics, intensity);
  const minCalories = context.user.gender === 'female' ? 1200 : 1400;
  const targetCalories = Math.max(minCalories, metrics.tdee - deficit);
  const proteinFactor = lifestyle.hasStrengthTraining ? 1.8 : 1.6;
  const fastingWindow = strategyType === 'if_16_8' ? pickFastingWindow(lifestyle) : undefined;
  return {
    tdee: metrics.tdee,
    targetCalories,
    proteinGrams: Math.round(context.user.weight * proteinFactor),
    fastingWindow,
    carbCycleConfig: strategyType === 'carb_cycling' ? { highDays: 2, midDays: 3, lowDays: 2 } : undefined,
  };
}

function calculateEvidenceBasedDailyDeficit(
  context: StrategyContext,
  lifestyle: UserLifestyleProfile,
  metrics: StrategyDerivedMetrics,
  intensity: StrategyIntensity,
) {
  const currentWeight = context.user.weight;
  const goalWeight = context.user.goalWeight;
  const targetWeeks = Math.max(2, Math.min(104, lifestyle.targetWeeks || 12));
  const weightToLoseKg = Math.max(0, currentWeight - goalWeight);
  const requestedWeeklyLossKg = weightToLoseKg > 0 ? weightToLoseKg / targetWeeks : 0.25;

  // 1 kg fat mass is commonly approximated as 7700 kcal; CDC's public guidance
  // frames gradual loss around 1-2 lb/week, so cap steady targets near 0.9 kg/week.
  const riskCapKgPerWeek = metrics.restrictionRisk >= 55 || lifestyle.bingeRisk === 'high'
    ? 0.45
    : intensity === 'aggressive'
      ? 0.9
      : intensity === 'gentle'
        ? 0.45
        : 0.68;
  const weeklyLossKg = clamp(requestedWeeklyLossKg, 0.25, riskCapKgPerWeek);
  const calculatedDeficit = Math.round((weeklyLossKg * 7700) / 7);

  const maxByTdee = Math.round(metrics.tdee * 0.25);
  return clamp(calculatedDeficit, 250, Math.max(250, maxByTdee));
}

function pickFastingWindow(lifestyle: UserLifestyleProfile) {
  if (lifestyle.isStudent) return { start: '11:00', end: '19:00', fastingHours: 16, eatingHours: 8 };
  if (lifestyle.workStudyRhythm === 'office') return { start: '12:30', end: '20:30', fastingHours: 16, eatingHours: 8 };
  return { start: '12:00', end: '20:00', fastingHours: 16, eatingHours: 8 };
}

function calculateAdherenceScore(context: StrategyContext) {
  const plans = context.plans || [];
  const meals = context.meals || [];
  const weights = context.weights || [];
  const completedRate = plans.length ? plans.filter(plan => plan.completed).length / plans.length : 0.55;
  const mealDays = new Set(meals.map(meal => meal.date)).size;
  const mealRate = plans.length ? mealDays / Math.min(plans.length, 14) : 0.45;
  const weightRate = Math.min(1, weights.length / 4);
  return clamp(Math.round((completedRate * 0.45 + mealRate * 0.35 + weightRate * 0.2) * 100), 0, 100);
}

function getUserSegment(lifestyle: UserLifestyleProfile, trainingReadiness: number, restrictionRisk: number): StrategyDerivedMetrics['userSegment'] {
  if (restrictionRisk >= 65) return 'L4_risk_recovery';
  if (trainingReadiness >= 65 && lifestyle.hasStrengthTraining) return 'L3_training_driven';
  if (lifestyle.oftenStaysUpLate || lifestyle.dietRegularity === 'irregular') return 'L2_chaotic_rhythm';
  return 'L1_beginner_low_friction';
}

function buildReasons(strategyType: FatLossStrategyType, context: StrategyContext, lifestyle: UserLifestyleProfile, metrics: StrategyDerivedMetrics) {
  if (strategyType === 'carb_cycling') {
    return [
      `你每周训练约 ${context.user.trainingFrequency} 次，力量训练基础足够支撑高碳/低碳日安排。`,
      '把高碳日放在腿/背等大肌群训练日，更容易兼顾训练表现和减脂速度。',
      `当前复杂计划耐受度为 ${metrics.strategyComplexityTolerance}/100，适合执行更精细的策略。`,
    ];
  }
  if (strategyType === 'if_16_8') {
    return [
      lifestyle.oftenStaysUpLate ? '你经常熬夜或作息不稳定，先减少进食时间窗口比复杂计算更容易坚持。' : '你的饮食节奏不够固定，16+8 能先建立清晰边界。',
      '相比碳循环，轻断食不需要每天切换复杂宏量营养目标。',
      '系统会继续保留蛋白和总热量底线，避免因为少吃一餐导致过度限制。',
    ];
  }
  return [
    '热量缺口是最稳的基础策略，适合从当前记录工具平滑升级。',
    context.user.trainingFrequency < 3 ? '你当前训练频率不高，暂时不需要复杂碳循环。' : '先建立稳定热量和蛋白目标，可以为后续升级策略打基础。',
    `当前 TDEE 估算约 ${metrics.tdee} kcal，适合从温和到标准缺口开始。`,
  ];
}

function buildWhyNot(strategyType: FatLossStrategyType, context: StrategyContext, lifestyle: UserLifestyleProfile): Record<FatLossStrategyType, string> {
  return {
    calorie_deficit: strategyType === 'calorie_deficit' ? '当前主策略。' : '热量缺口仍作为底层安全边界，但不是当前最低阻力的执行方式。',
    if_16_8: strategyType === 'if_16_8' ? '当前主策略。' : lifestyle.bingeRisk === 'high' ? '暴食风险偏高时，不把进食窗口收得太紧。' : '你的节奏暂时不需要只靠进食窗口管理。',
    carb_cycling: strategyType === 'carb_cycling' ? '当前主策略。' : context.user.trainingFrequency < 3 ? '训练频率未稳定到每周 3 次以上，暂不推荐复杂碳循环。' : '当前执行稳定性还可以先用更简单策略建立基础。',
  };
}

function buildSafetyFlags(context: StrategyContext, lifestyle: UserLifestyleProfile, metrics: StrategyDerivedMetrics, intensity: StrategyIntensity) {
  const flags: string[] = [];
  if (context.user.age < 18) flags.push('未成年人不建议自行执行激进减脂策略。');
  if (metrics.bmi < 20) flags.push('BMI 偏低，系统已限制为更温和的目标。');
  if (lifestyle.bingeRisk === 'high') flags.push('暴食风险偏高，优先降低限制强度。');
  if (intensity === 'aggressive') flags.push('激进缺口仅建议短期使用，并需要观察睡眠、饥饿感和训练表现。');
  return flags;
}

function buildStageGoal(strategyType: FatLossStrategyType, intensity: StrategyIntensity, weeklyLoss: number) {
  const prefix = strategyType === 'if_16_8' ? '先稳定 16+8 窗口' : strategyType === 'carb_cycling' ? '先稳定训练日碳水节奏' : '先稳定每日热量和蛋白';
  return `${prefix}，未来 2 周目标约 ${weeklyLoss.toFixed(1)} kg/周，强度：${intensityLabel(intensity)}。`;
}

function buildUserFacingMessage(strategyType: FatLossStrategyType, reasons: string[]) {
  return `AI 推荐你先使用「${STRATEGY_LABELS[strategyType]}」。${reasons[0]}`;
}

function getConfidence(scores: StrategyRecommendation['scores']) {
  const ordered = Object.values(scores).sort((a, b) => b - a);
  const gap = ordered[0] - ordered[1];
  if (gap >= 18) return 'high';
  if (gap >= 8) return 'medium';
  return 'low';
}

function estimateWeeklyLoss(tdee: number, targetCalories: number, safetyFlags: string[]) {
  const deficit = Math.max(0, tdee - targetCalories);
  const kg = (deficit * 7) / 7700;
  const capped = safetyFlags.length ? Math.min(0.75, kg) : kg;
  return round1(clamp(capped, 0.25, 1));
}

function decoratePlan(plan: DayPlan, strategyType: FatLossStrategyType, strategyId: string | undefined, targets: StrategyTargets): DayPlan {
  return {
    ...plan,
    strategyType,
    strategyId,
    dayGoal: {
      strategyType,
      focus: 'training_matched_carb_cycle',
      tdee: targets.tdee,
    },
  };
}

function getProxyCarbType(strategyType: FatLossStrategyType, offset: number, trainingDay: TrainingDay): CarbType {
  if (strategyType === 'if_16_8') return 'mid';
  if (trainingDay.muscleGroup === 'rest') return 'low';
  return offset % 3 === 0 ? 'high' : 'mid';
}

function activityFactor(trainingFrequency: number) {
  if (trainingFrequency >= 6) return 1.72;
  if (trainingFrequency >= 4) return 1.55;
  if (trainingFrequency >= 2) return 1.38;
  return 1.25;
}

function intensityLabel(intensity: StrategyIntensity) {
  if (intensity === 'gentle') return '温和';
  if (intensity === 'aggressive') return '激进';
  return '标准';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
