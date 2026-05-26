import { calculateMealCalories } from '@/lib/mock-data';
import type { DigitalTwinDataSet, DigitalTwinFeatures, PlateauRisk } from '@/lib/digital-twin/types';

export function extractDigitalTwinFeatures(data: DigitalTwinDataSet, horizonDays = 30): DigitalTwinFeatures {
  const sortedWeights = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const currentWeight = sortedWeights[sortedWeights.length - 1]?.weight ?? data.user.weight;
  const dateSet = new Set(data.plans.map(plan => plan.date));
  const mealDates = new Set(data.meals.map(meal => meal.date));
  const completedDays = data.plans.filter(plan => plan.completed).length;
  const dataStartDate = sortedWeights[0]?.date || data.user.startDate;
  const dataEndDate = sortedWeights[sortedWeights.length - 1]?.date || data.user.startDate;
  const totalDays = Math.max(1, diffDays(dataStartDate, dataEndDate) + 1);
  const slope7d = slopeForWindow(sortedWeights, 7);
  const slope14d = slopeForWindow(sortedWeights, 14);
  const slope30d = slopeForWindow(sortedWeights, 30);
  const slopeKgPerDay = chooseTrendSlope(slope7d, slope14d, slope30d);
  const residualStd = getResidualStd(sortedWeights.slice(-30), slope30d || slopeKgPerDay);
  const mealLoggedDays = mealDates.size;
  const mealLoggingRate30d = rateForRecentDates([...mealDates], dataEndDate, 30);
  const checkinRate30d = data.plans.length ? data.plans.filter(plan => plan.completed).length / data.plans.length : 0;
  const nutrition = buildNutritionProfile(data);
  const plateauRisk = getPlateauRisk({ slope7d, slope14d, mealLoggingRate30d, avgCalorieGap: nutrition.avgCalorieGap, weightCount: sortedWeights.length });
  const confidence = getConfidence(sortedWeights.length, mealLoggedDays, data.plans.length);

  return {
    confidence,
    dataQuality: {
      weightDays: sortedWeights.length,
      mealLoggedDays,
      completedDays,
      chatMessages: data.chatMessages.length,
      predictionConfidence: confidence,
      missingSignals: ['steps', 'sleep'],
    },
    persona: {
      age: data.user.age,
      gender: data.user.gender,
      height: data.user.height,
      currentWeight,
      goalWeight: data.user.goalWeight,
      bodyFat: data.user.bodyFat,
      trainingFrequency: data.user.trainingFrequency,
      somatotype: data.user.somatotype,
      fatLossType: classifyFatLossType(slopeKgPerDay, plateauRisk),
    },
    behaviorProfile: {
      loggingConsistency: round2((mealLoggedDays + completedDays + sortedWeights.length) / Math.max(1, totalDays * 3)),
      mealLoggingRate7d: round2(rateForRecentDates([...mealDates], dataEndDate, 7)),
      mealLoggingRate30d: round2(mealLoggingRate30d),
      checkinRate7d: round2(checkinRateForWindow(data.plans, dataEndDate, 7)),
      checkinRate30d: round2(checkinRate30d),
      longestCheckinStreak: getLongestStreak(data.plans),
      weekendOverrunPattern: detectWeekendOverrun(data),
      acceptedAdviceTypes: data.actionProposals.filter(item => item.status === 'accepted').map(item => item.type).slice(-5),
      rejectedAdviceTypes: data.actionProposals.filter(item => item.status === 'dismissed').map(item => item.type).slice(-5),
    },
    nutritionProfile: nutrition,
    trainingProfile: {
      plannedTrainingDays: data.plans.filter(plan => plan.muscleGroup && plan.muscleGroup !== 'rest').length,
      highCarbTrainingMatchRate: getHighCarbMatchRate(data.plans),
      completedDays,
      carbCyclePattern: summarizeCarbCycle(data.plans),
    },
    plateauProfile: {
      risk: plateauRisk,
      slope7d,
      slope14d,
      slope30d,
      recentWeightChange14d: getWeightChange(sortedWeights, 14),
      dataCompleteness: round2((mealLoggingRate30d + checkinRate30d) / 2),
    },
    modelSummary: {
      currentWeight,
      goalWeight: data.user.goalWeight,
      slope7d,
      slope14d,
      slope30d,
      slopeKgPerDay,
      slopeKgPerWeek: round4(slopeKgPerDay * 7),
      residualStd,
      trendConfidence: confidence,
      plateauRisk,
      explanation: buildExplanation(plateauRisk, slopeKgPerDay, horizonDays),
    },
  };
}

export function getDataRange(data: DigitalTwinDataSet) {
  const dates = [
    ...data.weights.map(item => item.date),
    ...data.meals.map(item => item.date),
    ...data.plans.map(item => item.date),
  ].sort();
  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
  };
}

function buildNutritionProfile(data: DigitalTwinDataSet) {
  const byDate = new Map<string, typeof data.meals>();
  for (const meal of data.meals) byDate.set(meal.date, [...(byDate.get(meal.date) || []), meal]);
  const daily = [...byDate.entries()].map(([date, meals]) => {
    const plan = data.plans.find(item => item.date === date);
    const calories = meals.reduce((sum, meal) => sum + (meal.calories ?? calculateMealCalories(meal)), 0);
    const protein = meals.reduce((sum, meal) => sum + meal.protein, 0);
    return { date, calories, protein, targetCalories: plan?.calories || 0, targetProtein: plan?.protein || 0 };
  });
  const recent7 = daily.slice(-7);
  const recent30 = daily.slice(-30);
  const proteinHitDays = daily.filter(day => day.targetProtein > 0 && day.protein / day.targetProtein >= 0.9).length;
  const highCalorieDays = daily.filter(day => day.targetCalories > 0 && day.calories > day.targetCalories * 1.2).length;
  const avgCalorieGap = average(daily.filter(day => day.targetCalories > 0).map(day => day.targetCalories - day.calories));
  return {
    avgCalories7d: Math.round(average(recent7.map(day => day.calories))),
    avgCalories30d: Math.round(average(recent30.map(day => day.calories))),
    avgProtein7d: Math.round(average(recent7.map(day => day.protein))),
    proteinHitRate: round2(daily.length ? proteinHitDays / daily.length : 0),
    avgCalorieGap: Math.round(avgCalorieGap),
    highCalorieDays,
  };
}

function slopeForWindow(weights: { date: string; weight: number }[], windowDays: number) {
  if (weights.length < 2) return 0;
  const latest = weights[weights.length - 1];
  const startTime = parseDate(latest.date) - (windowDays - 1) * 86400000;
  const points = weights.filter(item => parseDate(item.date) >= startTime);
  if (points.length < 2) return 0;
  const firstTime = parseDate(points[0].date);
  const xs = points.map(item => Math.round((parseDate(item.date) - firstTime) / 86400000));
  const ys = points.map(item => item.weight);
  const n = points.length;
  const sumX = xs.reduce((sum, value) => sum + value, 0);
  const sumY = ys.reduce((sum, value) => sum + value, 0);
  const sumXY = xs.reduce((sum, value, index) => sum + value * ys[index], 0);
  const sumXX = xs.reduce((sum, value) => sum + value * value, 0);
  const denominator = n * sumXX - sumX * sumX;
  return round4(denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator);
}

function chooseTrendSlope(slope7d: number, slope14d: number, slope30d: number) {
  if (slope14d) return round4(slope14d * 0.6 + slope30d * 0.4);
  return slope30d || slope7d;
}

function getResidualStd(weights: { date: string; weight: number }[], slope: number) {
  if (weights.length <= 2) return 0;
  const first = weights[0];
  const intercept = first.weight;
  const residuals = weights.map(item => {
    const x = Math.round((parseDate(item.date) - parseDate(first.date)) / 86400000);
    return item.weight - (intercept + slope * x);
  });
  return round2(Math.sqrt(residuals.reduce((sum, value) => sum + value * value, 0) / Math.max(1, residuals.length - 1)));
}

function getPlateauRisk(input: { slope7d: number; slope14d: number; mealLoggingRate30d: number; avgCalorieGap: number; weightCount: number }): PlateauRisk {
  if (input.weightCount < 7) return 'unknown';
  if (Math.abs(input.slope14d) < 0.015 && input.mealLoggingRate30d >= 0.5 && input.avgCalorieGap <= 150) return 'high';
  if (Math.abs(input.slope7d) < 0.015 && input.slope14d < 0) return 'medium';
  if (input.slope14d < -0.02) return 'low';
  return 'medium';
}

function getConfidence(weightDays: number, mealDays: number, planDays: number) {
  if (weightDays >= 14 && mealDays >= 10 && planDays >= 14) return 'high';
  if (weightDays >= 7 && mealDays >= 4) return 'medium';
  return 'low';
}

function classifyFatLossType(slope: number, plateauRisk: PlateauRisk) {
  if (plateauRisk === 'high') return '平台观察型';
  if (slope < -0.05) return '快速下降型';
  if (slope < -0.015) return '稳定下降型';
  return '缓慢调整型';
}

function detectWeekendOverrun(data: DigitalTwinDataSet) {
  return data.meals.some(meal => {
    const day = new Date(`${meal.date}T00:00:00`).getDay();
    if (day !== 0 && day !== 6) return false;
    const plan = data.plans.find(item => item.date === meal.date);
    if (!plan) return false;
    const calories = data.meals.filter(item => item.date === meal.date).reduce((sum, item) => sum + (item.calories ?? calculateMealCalories(item)), 0);
    return calories > plan.calories * 1.2;
  });
}

function getHighCarbMatchRate(plans: DigitalTwinDataSet['plans']) {
  const high = plans.filter(plan => plan.carbType === 'high');
  if (!high.length) return 0;
  return round2(high.filter(plan => plan.muscleGroup === 'legs' || plan.muscleGroup === 'back').length / high.length);
}

function summarizeCarbCycle(plans: DigitalTwinDataSet['plans']) {
  return {
    high: plans.filter(plan => plan.carbType === 'high').length,
    mid: plans.filter(plan => plan.carbType === 'mid').length,
    low: plans.filter(plan => plan.carbType === 'low').length,
  };
}

function getLongestStreak(plans: DigitalTwinDataSet['plans']) {
  let longest = 0;
  let current = 0;
  for (const plan of [...plans].sort((a, b) => a.date.localeCompare(b.date))) {
    current = plan.completed ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function checkinRateForWindow(plans: DigitalTwinDataSet['plans'], endDate: string, windowDays: number) {
  const end = parseDate(endDate);
  const start = end - (windowDays - 1) * 86400000;
  const window = plans.filter(plan => parseDate(plan.date) >= start && parseDate(plan.date) <= end);
  return window.length ? window.filter(plan => plan.completed).length / window.length : 0;
}

function rateForRecentDates(dates: string[], endDate: string, windowDays: number) {
  if (!dates.length) return 0;
  const end = parseDate(endDate);
  const start = end - (windowDays - 1) * 86400000;
  return new Set(dates.filter(date => parseDate(date) >= start && parseDate(date) <= end)).size / windowDays;
}

function getWeightChange(weights: { date: string; weight: number }[], windowDays: number) {
  if (weights.length < 2) return 0;
  const latest = weights[weights.length - 1];
  const start = parseDate(latest.date) - (windowDays - 1) * 86400000;
  const window = weights.filter(item => parseDate(item.date) >= start);
  if (window.length < 2) return 0;
  return round2(window[window.length - 1].weight - window[0].weight);
}

function buildExplanation(risk: PlateauRisk, slope: number, horizonDays: number) {
  if (risk === 'high') return `最近趋势接近停滞，未来 ${horizonDays} 天更适合先提高记录完整度，再小幅调整策略。`;
  if (slope < -0.02) return `当前趋势仍在下降，未来 ${horizonDays} 天优先保持执行稳定。`;
  return `当前下降速度较慢，未来 ${horizonDays} 天建议观察平均体重并优化蛋白和活动量。`;
}

function diffDays(a: string, b: string) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00`).getTime();
}

function average(values: number[]) {
  const valid = values.filter(value => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}
