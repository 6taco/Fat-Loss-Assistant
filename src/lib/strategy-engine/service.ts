import type { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { dayPlanToResponse, mealLogToResponse, toDate, userToResponse, weightToResponse } from '@/lib/server-mappers';
import { deriveStrategyMetrics, generateStrategyDayPlans, recommendFatLossStrategy } from '@/lib/strategy-engine/engine';
import { lifestyleToResponse, strategyProposalToResponse, strategyToResponse } from '@/lib/strategy-engine/mappers';
import type {
  FatLossStrategyType,
  StrategyCurrentResponse,
  StrategyIntensity,
  StrategyRecommendation,
  UserLifestyleProfile,
} from '@/lib/strategy-engine/types';

export async function getCurrentStrategyResponse(userId: string): Promise<StrategyCurrentResponse> {
  const prisma = getPrisma();
  const [user, lifestyle, activeStrategy, plans, meals, weights, proposals] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userLifestyleProfile.findUnique({ where: { userId } }).catch(() => null),
    prisma.fatLossStrategyProfile.findFirst({ where: { userId, status: 'active' }, orderBy: { createdAt: 'desc' } }).catch(() => null),
    prisma.dayPlan.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.mealLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { date: 'asc' }, take: 30 }),
    prisma.strategyAdjustmentProposal.findMany({ where: { userId, status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 3 }).catch(() => []),
  ]);

  if (!user) throw new Error('User not found');

  const userDto = userToResponse(user);
  const lifestyleDto = lifestyle ? lifestyleToResponse(lifestyle) : undefined;
  const planDtos = plans.map(dayPlanToResponse);
  const recommendation = recommendFatLossStrategy({
    user: userDto,
    lifestyle: lifestyleDto,
    plans: planDtos,
    meals: meals.map(mealLogToResponse),
    weights: weights.map(weightToResponse),
  });

  return {
    strategy: activeStrategy ? strategyToResponse(activeStrategy) : null,
    recommendation,
    todayPlan: getTodayPlan(planDtos),
    executionRate: calculateExecutionRate(planDtos),
    adjustmentProposals: proposals.map(strategyProposalToResponse),
    source: activeStrategy ? 'db' : 'computed',
  };
}

export async function recommendForUser(userId: string, lifestyleInput?: Partial<UserLifestyleProfile>): Promise<StrategyRecommendation> {
  const prisma = getPrisma();
  const [user, lifestyle, plans, meals, weights] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userLifestyleProfile.findUnique({ where: { userId } }).catch(() => null),
    prisma.dayPlan.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.mealLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { date: 'asc' }, take: 30 }),
  ]);

  if (!user) throw new Error('User not found');
  const userDto = userToResponse(user);
  const lifestyleDto = { ...(lifestyle ? lifestyleToResponse(lifestyle) : {}), ...lifestyleInput };
  return recommendFatLossStrategy({
    user: userDto,
    lifestyle: lifestyleDto,
    plans: plans.map(dayPlanToResponse),
    meals: meals.map(mealLogToResponse),
    weights: weights.map(weightToResponse),
  });
}

export async function upsertLifestyleProfile(userId: string, input: Partial<UserLifestyleProfile>) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  const userDto = userToResponse(user);
  const derivedMetrics = deriveStrategyMetrics({ user: userDto }, input);

  const data = {
    sleepRegularity: input.sleepRegularity || 'mixed',
    averageSleepHours: input.averageSleepHours,
    workStudyRhythm: input.workStudyRhythm || 'flexible',
    oftenStaysUpLate: input.oftenStaysUpLate ?? false,
    isStudent: input.isStudent ?? false,
    dietRegularity: input.dietRegularity || 'mixed',
    bingeRisk: input.bingeRisk || 'low',
    takeawayFrequency: input.takeawayFrequency || 'medium',
    complexPlanTolerance: input.complexPlanTolerance || 'medium',
    hasFitnessHabit: input.hasFitnessHabit ?? user.trainingFrequency > 0,
    hasStrengthTraining: input.hasStrengthTraining ?? user.trainingFrequency >= 3,
    trainingExperience: input.trainingExperience || 'beginner',
    fatLossGoal: input.fatLossGoal || 'appearance',
    targetWeeks: input.targetWeeks,
    derivedMetrics: derivedMetrics as unknown as Prisma.InputJsonValue,
  };

  const saved = await prisma.userLifestyleProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return lifestyleToResponse(saved);
}

export async function activateStrategy(userId: string, options: {
  strategyType?: FatLossStrategyType;
  intensity?: StrategyIntensity;
  startDate?: string;
} = {}) {
  const prisma = getPrisma();
  const [user, lifestyle, plans, meals, weights] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userLifestyleProfile.findUnique({ where: { userId } }).catch(() => null),
    prisma.dayPlan.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.mealLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { date: 'asc' }, take: 30 }),
  ]);
  if (!user) throw new Error('User not found');

  const baseRecommendation = recommendFatLossStrategy({
    user: userToResponse(user),
    lifestyle: lifestyle ? lifestyleToResponse(lifestyle) : undefined,
    plans: plans.map(dayPlanToResponse),
    meals: meals.map(mealLogToResponse),
    weights: weights.map(weightToResponse),
  });
  const strategyType = options.strategyType || baseRecommendation.strategyType;
  const intensity = options.intensity || baseRecommendation.intensity;
  const startDate = options.startDate || today();
  const recommendation = buildRecommendationForSelectedStrategy(baseRecommendation, strategyType, intensity, userToResponse(user), lifestyle ? lifestyleToResponse(lifestyle) : undefined, startDate);
  const targets = recommendation.targets;

  return prisma.$transaction(async tx => {
    await tx.fatLossStrategyProfile.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'superseded', endDate: toDate(startDate) },
    });

    const strategy = await tx.fatLossStrategyProfile.create({
      data: {
        userId,
        strategyType,
        intensity,
        startDate: toDate(startDate),
        tdee: targets.tdee,
        targetCalories: targets.targetCalories,
        proteinGrams: targets.proteinGrams,
        fastingWindow: targets.fastingWindow as Prisma.InputJsonValue | undefined,
        carbCycleConfig: targets.carbCycleConfig as Prisma.InputJsonValue | undefined,
        expectedLossKgPerWeek: recommendation.expectedWeightLossKgPerWeek,
        stageGoal: recommendation.stageGoal,
        recommendationReasons: recommendation.reasons as Prisma.InputJsonValue,
        scoreBreakdown: recommendation.scores as Prisma.InputJsonValue,
        safetyFlags: recommendation.safetyFlags as Prisma.InputJsonValue,
      },
    });

    const plans = generateStrategyDayPlans({
      strategyType,
      intensity,
      startDate,
      user: userToResponse(user),
      targets,
      trainingSchedule: userToResponse(user).trainingSchedule,
      strategyId: strategy.id,
    });

    await Promise.all(plans.map(plan => tx.dayPlan.upsert({
      where: { userId_date: { userId, date: toDate(plan.date) } },
      create: planToDbCreate(userId, plan),
      update: planToDbUpdate(plan),
    })));

    return {
      strategy: strategyToResponse(strategy),
      plans,
      recommendation,
    };
  });
}

export async function recheckStrategy(userId: string) {
  const prisma = getPrisma();
  const current = await getCurrentStrategyResponse(userId);
  if (!current.strategy) {
    const activated = await activateStrategy(userId);
    return { proposal: null, activated };
  }

  const recommendation = current.recommendation;
  const shouldSwitch = recommendation.strategyType !== current.strategy.strategyType
    && recommendation.confidence !== 'low';
  const shouldReduceRestriction = recommendation.derivedMetrics.restrictionRisk >= 65;
  const lowExecution = current.executionRate < 50;

  if (!shouldSwitch && !shouldReduceRestriction && !lowExecution) return { proposal: null };

  const title = shouldSwitch
    ? `建议切换到${strategyName(recommendation.strategyType)}`
    : '建议降低当前策略限制强度';
  const summary = shouldSwitch
    ? recommendation.userFacingMessage
    : '最近执行压力偏高，建议先把策略调温和，优先恢复记录、蛋白和睡眠。';
  const payload = {
    userId,
    strategyType: shouldSwitch ? recommendation.strategyType : current.strategy.strategyType,
    intensity: shouldReduceRestriction || lowExecution ? 'gentle' : recommendation.intensity,
    startDate: today(),
  };

  const actionProposal = await prisma.actionProposal.create({
    data: {
      userId,
      type: shouldSwitch ? 'switch_fat_loss_strategy' : 'adjust_strategy_intensity',
      title,
      summary,
      payload: payload as Prisma.InputJsonValue,
      reason: {
        recommendation: recommendation.reasons,
        executionRate: current.executionRate,
        restrictionRisk: recommendation.derivedMetrics.restrictionRisk,
      } as Prisma.InputJsonValue,
      safety: { requiresUserConfirmation: true } as Prisma.InputJsonValue,
      toolName: shouldSwitch ? 'switch_fat_loss_strategy' : 'adjust_strategy_intensity',
      executionState: 'pending_confirmation',
      diffPreview: {
        from: current.strategy.strategyType,
        to: payload.strategyType,
        intensity: payload.intensity,
      } as Prisma.InputJsonValue,
    },
  });

  const proposal = await prisma.strategyAdjustmentProposal.create({
    data: {
      userId,
      fromStrategyId: current.strategy.id,
      toStrategyType: shouldSwitch ? recommendation.strategyType : current.strategy.strategyType,
      title,
      summary,
      reason: actionProposal.reason as Prisma.InputJsonValue,
      diffPreview: actionProposal.diffPreview as Prisma.InputJsonValue,
      actionProposalId: actionProposal.id,
    },
  });

  return { proposal: strategyProposalToResponse(proposal), actionProposal };
}

function planToDbCreate(userId: string, plan: ReturnType<typeof generateStrategyDayPlans>[number]) {
  return {
    userId,
    date: toDate(plan.date),
    carbType: plan.carbType,
    calories: plan.calories,
    carb: plan.carb,
    protein: plan.protein,
    fat: plan.fat,
    completed: plan.completed,
    strategyId: plan.strategyId,
    strategyType: plan.strategyType || 'carb_cycling',
    fastingWindow: plan.fastingWindow as Prisma.InputJsonValue | undefined,
    dayGoal: plan.dayGoal as Prisma.InputJsonValue | undefined,
    muscleGroup: plan.muscleGroup,
    trainingLabel: plan.trainingLabel,
  };
}

function buildRecommendationForSelectedStrategy(
  base: StrategyRecommendation,
  strategyType: FatLossStrategyType,
  intensity: StrategyIntensity,
  user: ReturnType<typeof userToResponse>,
  lifestyle: Partial<UserLifestyleProfile> | undefined,
  startDate: string,
): StrategyRecommendation {
  if (base.strategyType === strategyType && base.intensity === intensity) return base;

  const selected = recommendFatLossStrategy({
    user,
    lifestyle,
    date: startDate,
  });
  return {
    ...selected,
    strategyType,
    intensity,
    targets: selected.targets,
    generatedPlanPreview: generateStrategyDayPlans({
      strategyType,
      intensity,
      startDate,
      user,
      targets: selected.targets,
      trainingSchedule: user.trainingSchedule,
    }).slice(0, 28),
    userFacingMessage: `你选择了「${strategyName(strategyType)}」。AI 原推荐为「${strategyName(base.strategyType)}」，系统会按你选择的策略生成目标。`,
    reasons: strategyType === base.strategyType
      ? selected.reasons
      : [
        `你手动选择了「${strategyName(strategyType)}」，系统会尊重你的选择并使用对应的科学目标。`,
        ...selected.reasons.slice(0, 2),
      ],
    stageGoal: selected.stageGoal,
  };
}

function planToDbUpdate(plan: ReturnType<typeof generateStrategyDayPlans>[number]) {
  const data = planToDbCreate('', plan);
  return {
    date: data.date,
    carbType: data.carbType,
    calories: data.calories,
    carb: data.carb,
    protein: data.protein,
    fat: data.fat,
    strategyId: data.strategyId,
    strategyType: data.strategyType,
    fastingWindow: data.fastingWindow,
    dayGoal: data.dayGoal,
    muscleGroup: data.muscleGroup,
    trainingLabel: data.trainingLabel,
  };
}

function getTodayPlan(plans: ReturnType<typeof dayPlanToResponse>[]) {
  const iso = today();
  return plans.find(plan => plan.date === iso) || plans[0];
}

function calculateExecutionRate(plans: ReturnType<typeof dayPlanToResponse>[]) {
  const pastPlans = plans.filter(plan => plan.date <= today()).slice(-7);
  if (!pastPlans.length) return 0;
  return Math.round((pastPlans.filter(plan => plan.completed).length / pastPlans.length) * 100);
}

function strategyName(strategyType: FatLossStrategyType) {
  if (strategyType === 'calorie_deficit') return '热量缺口';
  if (strategyType === 'if_16_8') return '16+8 轻断食';
  return '碳循环';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
