import { calculateMealCalories, FoodItem } from '@/lib/mock-data';

export interface NutritionEstimate {
  description?: string;
  items: FoodItem[];
  carb: number;
  protein: number;
  fat: number;
  calories: number;
}

export function parseNutritionEstimate(content: string): NutritionEstimate {
  const jsonText = content.replace(/```json|```/g, '').trim();
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI did not return JSON');

  const raw = JSON.parse(jsonText.slice(start, end + 1)) as Partial<NutritionEstimate>;
  const items = Array.isArray(raw.items)
    ? raw.items.map(item => ({
      name: String(item.name || '未知食物'),
      amountText: item.amountText ? String(item.amountText) : undefined,
      carb: toNonNegativeNumber(item.carb),
      protein: toNonNegativeNumber(item.protein),
      fat: toNonNegativeNumber(item.fat),
    }))
    : [];

  const fallbackTotals = items.reduce(
    (sum, item) => ({
      carb: sum.carb + item.carb,
      protein: sum.protein + item.protein,
      fat: sum.fat + item.fat,
    }),
    { carb: 0, protein: 0, fat: 0 },
  );

  const estimate = {
    description: raw.description ? String(raw.description) : undefined,
    items,
    carb: toNonNegativeNumber(raw.carb ?? fallbackTotals.carb),
    protein: toNonNegativeNumber(raw.protein ?? fallbackTotals.protein),
    fat: toNonNegativeNumber(raw.fat ?? fallbackTotals.fat),
  };

  return {
    ...estimate,
    calories: calculateMealCalories(estimate),
  };
}

export function toNonNegativeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}
