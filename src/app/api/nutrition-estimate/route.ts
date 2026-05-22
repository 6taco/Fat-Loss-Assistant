import { NextRequest, NextResponse } from 'next/server';
import { askDeepSeek } from '@/lib/deepseek';
import { calculateMealCalories, FoodItem } from '@/lib/mock-data';

interface NutritionEstimateBody {
  description?: string;
  mealType?: string;
}

interface NutritionEstimate {
  items: FoodItem[];
  carb: number;
  protein: number;
  fat: number;
  calories: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NutritionEstimateBody;
    const description = body.description?.trim();

    if (!description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const content = await askDeepSeek([
      {
        role: 'system',
        content: [
          '你是营养估算助手，只返回 JSON，不要 Markdown。',
          '根据中文食物描述估算碳水、蛋白质、脂肪，单位为克。',
          '输出格式必须是 {"items":[{"name":"食物","amountText":"份量","carb":0,"protein":0,"fat":0}],"carb":0,"protein":0,"fat":0}。',
          '不知道精确重量时按常见中国餐食份量估算，数值四舍五入到整数。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `餐次：${body.mealType || '未指定'}\n食物：${description}`,
      },
    ]);

    const parsed = parseEstimate(content);
    return NextResponse.json({ estimate: parsed, source: 'ai' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'manual' }, { status: 502 });
  }
}

function parseEstimate(content: string): NutritionEstimate {
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

function toNonNegativeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Nutrition estimate failed';
}
