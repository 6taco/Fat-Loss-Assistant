import { calculateMealCalories, type FoodItem } from '@/lib/mock-data';

export interface NutritionEstimate {
  description?: string;
  items: FoodItem[];
  carb: number;
  protein: number;
  fat: number;
  calories: number;
  confidence?: number;
  warnings?: string[];
}

interface NutritionEstimateRaw {
  description?: unknown;
  items?: unknown;
  totals?: {
    carb?: unknown;
    protein?: unknown;
    fat?: unknown;
    calories?: unknown;
  };
  carb?: unknown;
  protein?: unknown;
  fat?: unknown;
  calories?: unknown;
  confidence?: unknown;
  warnings?: unknown;
}

export function parseNutritionEstimate(content: string): NutritionEstimate {
  const jsonText = content.replace(/```json|```/g, '').trim();
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI did not return JSON');

  const raw = JSON.parse(jsonText.slice(start, end + 1)) as NutritionEstimateRaw;
  const items = normalizeItems(raw.items);
  const fallbackTotals = items.reduce(
    (sum, item) => ({
      carb: sum.carb + item.carb,
      protein: sum.protein + item.protein,
      fat: sum.fat + item.fat,
      calories: sum.calories + (item.calories ?? calculateMealCalories(item)),
    }),
    { carb: 0, protein: 0, fat: 0, calories: 0 },
  );
  const totals = raw.totals || {};
  const estimate = {
    description: raw.description ? String(raw.description) : undefined,
    items,
    carb: toNonNegativeNumber(totals.carb ?? raw.carb ?? fallbackTotals.carb),
    protein: toNonNegativeNumber(totals.protein ?? raw.protein ?? fallbackTotals.protein),
    fat: toNonNegativeNumber(totals.fat ?? raw.fat ?? fallbackTotals.fat),
    calories: toNonNegativeNumber(totals.calories ?? raw.calories ?? fallbackTotals.calories),
    confidence: toConfidence(raw.confidence),
    warnings: normalizeWarnings(raw.warnings),
  };

  return {
    ...estimate,
    calories: estimate.calories || calculateMealCalories(estimate),
  };
}

export function stringifyNutritionEstimate(estimate: NutritionEstimate): string {
  return JSON.stringify({
    description: estimate.description,
    items: estimate.items,
    totals: {
      calories: estimate.calories,
      protein: estimate.protein,
      fat: estimate.fat,
      carb: estimate.carb,
    },
    confidence: estimate.confidence,
    warnings: estimate.warnings || [],
  });
}

export function toNonNegativeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function normalizeItems(value: unknown): FoodItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): FoodItem => {
    const source = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const carb = toNonNegativeNumber(source.carb);
    const protein = toNonNegativeNumber(source.protein);
    const fat = toNonNegativeNumber(source.fat);
    const calories = toNonNegativeNumber(source.calories);
    return {
      name: String(source.name || '未知食物'),
      amountText: source.amountText ? String(source.amountText) : undefined,
      weightGram: source.weightGram !== undefined ? toNonNegativeNumber(source.weightGram) : undefined,
      calories: calories || calculateMealCalories({ carb, protein, fat }),
      confidence: toConfidence(source.confidence),
      carb,
      protein,
      fat,
    };
  }).filter(item => item.name.trim().length > 0);
}

function toConfidence(value: unknown): number | undefined {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  if (number > 1) return Math.max(0, Math.min(100, Math.round(number))) / 100;
  return Math.max(0, Math.min(1, Number(number.toFixed(2))));
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item).trim()).filter(Boolean).slice(0, 3);
}
