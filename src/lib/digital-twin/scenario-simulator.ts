import type { DigitalTwinFeatures, DigitalTwinForecastPoint, DigitalTwinPredictionDto, DigitalTwinScenarioDto, ScenarioInput } from '@/lib/digital-twin/types';

export function buildBaselinePrediction(features: DigitalTwinFeatures, horizonDays = 30): DigitalTwinPredictionDto {
  const currentWeight = features.modelSummary.currentWeight;
  const slope = features.modelSummary.slopeKgPerDay;
  const residual = Math.max(0.2, features.modelSummary.residualStd);
  const forecast = Array.from({ length: horizonDays }, (_, index) => {
    const day = index + 1;
    const predictedWeight = round1(currentWeight + slope * day);
    const uncertainty = residual * Math.sqrt(1 + day / horizonDays);
    return {
      date: addDays(new Date().toISOString().slice(0, 10), day),
      predictedWeight,
      lowerBound: round1(predictedWeight - uncertainty),
      upperBound: round1(predictedWeight + uncertainty),
    };
  });

  const last = forecast[forecast.length - 1];
  return {
    horizonDays,
    currentWeight,
    predictedWeight: last?.predictedWeight,
    goalProbability: goalProbability(currentWeight, features.modelSummary.goalWeight, last?.predictedWeight, features.confidence),
    slopeKgPerDay: slope,
    plateauRisk: features.modelSummary.plateauRisk,
    forecast,
    assumptions: {
      model: '最近体重趋势 + 执行折扣',
      confidence: features.confidence,
      horizonDays,
    },
    confidence: features.confidence,
    modelVersion: 'digital-twin-v1',
  };
}

export function simulateScenario(features: DigitalTwinFeatures, baseline: DigitalTwinPredictionDto, input: ScenarioInput): DigitalTwinScenarioDto {
  const horizonDays = input.horizonDays || baseline.horizonDays || 30;
  const dailyAdjustmentKg = getDailyAdjustmentKg(features, input);
  const forecast: DigitalTwinForecastPoint[] = baseline.forecast.slice(0, horizonDays).map((point, index) => {
    const day = index + 1;
    const scenarioWeight = round1(point.predictedWeight + dailyAdjustmentKg * day);
    return {
      ...point,
      scenarioWeight,
      predictedWeight: scenarioWeight,
      lowerBound: round1(point.lowerBound + dailyAdjustmentKg * day),
      upperBound: round1(point.upperBound + dailyAdjustmentKg * day),
    };
  });
  const predictedWeight = forecast[forecast.length - 1]?.predictedWeight;
  const baselineWeight = baseline.forecast[Math.min(horizonDays, baseline.forecast.length) - 1]?.predictedWeight;
  const deltaVsBaseline = predictedWeight !== undefined && baselineWeight !== undefined ? round1(predictedWeight - baselineWeight) : undefined;

  return {
    type: input.type,
    title: scenarioTitle(input),
    assumptions: scenarioAssumptions(input, features),
    result: {
      predictedWeight,
      deltaVsBaseline,
      range: forecast.length ? [forecast[forecast.length - 1].lowerBound, forecast[forecast.length - 1].upperBound] : undefined,
      explanation: scenarioExplanation(input, predictedWeight, deltaVsBaseline),
      forecast,
    },
    status: 'completed',
  };
}

export function defaultScenarios(features: DigitalTwinFeatures, baseline: DigitalTwinPredictionDto) {
  return [
    simulateScenario(features, baseline, { type: 'maintain_current', horizonDays: baseline.horizonDays }),
    simulateScenario(features, baseline, { type: 'add_steps', horizonDays: baseline.horizonDays, dailyStepsAdded: 5000 }),
    simulateScenario(features, baseline, { type: 'reduce_calories', horizonDays: baseline.horizonDays, dailyCalorieDelta: -100 }),
    simulateScenario(features, baseline, { type: 'improve_adherence', horizonDays: baseline.horizonDays, adherenceBoost: 0.15 }),
  ];
}

function getDailyAdjustmentKg(features: DigitalTwinFeatures, input: ScenarioInput) {
  const adherenceDiscount = features.confidence === 'high' ? 0.75 : features.confidence === 'medium' ? 0.65 : 0.5;
  if (input.type === 'reduce_calories') {
    const kcal = Math.abs(input.dailyCalorieDelta ?? -100);
    return -(kcal / 7700) * adherenceDiscount;
  }
  if (input.type === 'add_steps') {
    const steps = input.dailyStepsAdded ?? 5000;
    const kcal = Math.max(80, Math.min(300, steps * 0.04));
    return -(kcal / 7700) * adherenceDiscount;
  }
  if (input.type === 'improve_adherence') {
    const boost = input.adherenceBoost ?? 0.15;
    return -0.008 * Math.max(0, Math.min(0.3, boost)) / 0.15;
  }
  if (input.type === 'improve_protein') return -0.004;
  if (input.type === 'reorder_carb_cycle') return -0.003;
  return 0;
}

function scenarioTitle(input: ScenarioInput) {
  if (input.type === 'add_steps') return `每天增加 ${input.dailyStepsAdded ?? 5000} 步`;
  if (input.type === 'reduce_calories') return `每天少吃 ${Math.abs(input.dailyCalorieDelta ?? -100)} kcal`;
  if (input.type === 'improve_adherence') return '每周多完成 2 天打卡';
  if (input.type === 'improve_protein') return '提高蛋白达标率';
  if (input.type === 'reorder_carb_cycle') return '重排碳循环';
  return '保持当前饮食';
}

function scenarioAssumptions(input: ScenarioInput, features: DigitalTwinFeatures) {
  return {
    type: input.type,
    horizonDays: input.horizonDays || 30,
    dailyCalorieDelta: input.dailyCalorieDelta,
    dailyStepsAdded: input.dailyStepsAdded,
    adherenceBoost: input.adherenceBoost,
    confidence: features.confidence,
    note: '这是基于历史趋势的估算，不是医学诊断或保证结果。',
  };
}

function scenarioExplanation(input: ScenarioInput, predictedWeight?: number, delta?: number) {
  const target = predictedWeight === undefined ? '暂时无法估算最终体重' : `预计约 ${predictedWeight.toFixed(1)}kg`;
  const diff = delta === undefined ? '' : delta < 0 ? `，比基线少约 ${Math.abs(delta).toFixed(1)}kg` : delta > 0 ? `，比基线多约 ${delta.toFixed(1)}kg` : '，与基线接近';
  return `${scenarioTitle(input)}：${target}${diff}。预测会受水重、记录完整度和执行稳定性影响。`;
}

function goalProbability(currentWeight: number, goalWeight: number, predictedWeight: number | undefined, confidence: string) {
  if (predictedWeight === undefined) return 0;
  const totalGap = Math.max(0.1, currentWeight - goalWeight);
  const progress = Math.max(0, currentWeight - predictedWeight) / totalGap;
  const base = Math.round(Math.max(0, Math.min(1, progress)) * 80);
  const confidenceBonus = confidence === 'high' ? 15 : confidence === 'medium' ? 8 : 2;
  return Math.max(0, Math.min(100, base + confidenceBonus));
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
