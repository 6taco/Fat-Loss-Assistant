import {
  calculateMealCalories,
  type CalorieDeficitSummary,
  type DayPlan,
  type MealLog,
  type PlateauDetection,
  type WeightEntry,
  type WeightPredictionPoint,
  type WeightPredictionResult,
} from '@/lib/mock-data';

export interface WeightPredictionInput {
  userId: string;
  currentWeight: number;
  goalWeight: number;
  weightEntries: WeightEntry[];
  plans: DayPlan[];
  meals: MealLog[];
  horizonDays: number;
}

export interface WeightPredictionModel {
  version: WeightPredictionResult['modelVersion'];
  predict(input: WeightPredictionInput): WeightPredictionResult;
}

export class LinearRegressionWeightModel implements WeightPredictionModel {
  version = 'linear-regression-v1' as const;

  predict(input: WeightPredictionInput): WeightPredictionResult {
    const horizonDays = 30;
    const entries = normalizeWeights(input.weightEntries).slice(-90);
    const generatedAt = new Date().toISOString();
    const currentWeight = entries[entries.length - 1]?.weight ?? input.currentWeight;
    const calorieDeficit = summarizeCalorieDeficit(input.plans, input.meals);

    if (entries.length < 3) {
      return {
        userId: input.userId,
        generatedAt,
        currentWeight,
        goalWeight: input.goalWeight,
        goalProbability: 0,
        slopeKgPerDay: 0,
        residualStd: 0,
        plateau: {
          status: 'unknown',
          reason: '至少需要 3 条体重记录，才能生成更可信的趋势预测。',
          daysChecked: entries.length,
        },
        calorieDeficit,
        forecast30Days: [],
        modelVersion: this.version,
        status: 'insufficient_data',
      };
    }

    const firstTime = parseDate(entries[0].date);
    const points = entries.map(entry => ({
      x: Math.round((parseDate(entry.date) - firstTime) / 86400000),
      y: entry.weight,
    }));
    const { slope, intercept } = linearRegression(points);
    const residualStd = getResidualStd(points, slope, intercept);
    const latest = entries[entries.length - 1];
    const latestOffset = Math.round((parseDate(latest.date) - firstTime) / 86400000);
    const estimatedDaysToGoal = slope < 0 && currentWeight > input.goalWeight
      ? Math.max(1, Math.ceil((currentWeight - input.goalWeight) / Math.abs(slope)))
      : undefined;
    const estimatedGoalDate = estimatedDaysToGoal ? addDays(latest.date, estimatedDaysToGoal) : undefined;
    const plateau = detectPlateau(entries, calorieDeficit);
    const goalProbability = calculateGoalProbability({
      slope,
      residualStd,
      entriesCount: entries.length,
      calorieDeficit,
      estimatedDaysToGoal,
      plateau,
    });
    const forecast30Days: WeightPredictionPoint[] = Array.from({ length: horizonDays }, (_, index) => {
      const day = index + 1;
      const predictedWeight = intercept + slope * (latestOffset + day);
      const uncertainty = residualStd * Math.sqrt(1 + day / horizonDays);
      return {
        date: addDays(latest.date, day),
        predictedWeight: round1(predictedWeight),
        lowerBound: round1(predictedWeight - uncertainty),
        upperBound: round1(predictedWeight + uncertainty),
      };
    });

    return {
      userId: input.userId,
      generatedAt,
      currentWeight,
      goalWeight: input.goalWeight,
      estimatedGoalDate,
      estimatedDaysToGoal,
      goalProbability,
      slopeKgPerDay: Number(slope.toFixed(4)),
      residualStd: Number(residualStd.toFixed(3)),
      plateau,
      calorieDeficit,
      forecast30Days,
      modelVersion: this.version,
      status: 'ready',
    };
  }
}

export function buildWeightPrediction(input: WeightPredictionInput): WeightPredictionResult {
  return new LinearRegressionWeightModel().predict({ ...input, horizonDays: 30 });
}

function normalizeWeights(entries: WeightEntry[]) {
  const byDate = new Map<string, WeightEntry>();
  for (const entry of entries) byDate.set(entry.date, entry);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function getResidualStd(points: { x: number; y: number }[], slope: number, intercept: number) {
  if (points.length <= 2) return 0;
  const sumSquares = points.reduce((sum, point) => {
    const predicted = intercept + slope * point.x;
    return sum + (point.y - predicted) ** 2;
  }, 0);
  return Math.sqrt(sumSquares / (points.length - 2));
}

function summarizeCalorieDeficit(plans: DayPlan[], meals: MealLog[]): CalorieDeficitSummary {
  const mealsByDate = new Map<string, MealLog[]>();
  for (const meal of meals) mealsByDate.set(meal.date, [...(mealsByDate.get(meal.date) || []), meal]);
  let targetTotal = 0;
  let actualTotal = 0;
  let loggedDays = 0;

  for (const [date, dayMeals] of mealsByDate.entries()) {
    const plan = plans.find(item => item.date === date);
    if (!plan) continue;
    const actual = dayMeals.reduce((sum, meal) => sum + (meal.calories ?? calculateMealCalories(meal)), 0);
    targetTotal += plan.calories;
    actualTotal += actual;
    loggedDays += 1;
  }

  return {
    averageTargetCalories: loggedDays ? Math.round(targetTotal / loggedDays) : 0,
    averageActualCalories: loggedDays ? Math.round(actualTotal / loggedDays) : 0,
    averagePlanGap: loggedDays ? Math.round((targetTotal - actualTotal) / loggedDays) : 0,
    loggedDays,
  };
}

function detectPlateau(entries: WeightEntry[], calorieDeficit: CalorieDeficitSummary): PlateauDetection {
  const recent = entries.slice(-14);
  if (recent.length < 7) {
    return {
      status: 'unknown',
      reason: '平台期判断至少需要 7 天以上体重记录。',
      daysChecked: recent.length,
    };
  }

  const change = recent[recent.length - 1].weight - recent[0].weight;
  if (Math.abs(change) < 0.3 && calorieDeficit.loggedDays > 0 && calorieDeficit.averagePlanGap <= 150) {
    return {
      status: 'possible',
      reason: '最近体重变化较小，且热量执行没有明显低于目标，可能进入平台期。',
      daysChecked: recent.length,
    };
  }

  return {
    status: 'none',
    reason: '最近体重仍有可观察变化，暂未检测到明显平台期。',
    daysChecked: recent.length,
  };
}

function calculateGoalProbability({
  slope,
  residualStd,
  entriesCount,
  calorieDeficit,
  estimatedDaysToGoal,
  plateau,
}: {
  slope: number;
  residualStd: number;
  entriesCount: number;
  calorieDeficit: CalorieDeficitSummary;
  estimatedDaysToGoal?: number;
  plateau: PlateauDetection;
}) {
  let score = 40;
  if (slope < -0.02) score += 25;
  else if (slope < 0) score += 15;
  else score -= 20;
  if (residualStd <= 0.3) score += 15;
  else if (residualStd <= 0.7) score += 8;
  else score -= 10;
  if (entriesCount >= 14) score += 10;
  else if (entriesCount >= 7) score += 5;
  if (calorieDeficit.loggedDays >= 5 && calorieDeficit.averagePlanGap >= 0) score += 10;
  if (estimatedDaysToGoal && estimatedDaysToGoal <= 90) score += 8;
  if (plateau.status === 'possible') score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00`).getTime();
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
