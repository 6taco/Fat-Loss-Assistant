import { NextRequest, NextResponse } from 'next/server';
import { askDeepSeek } from '@/lib/deepseek';
import { parseNutritionEstimate } from '@/lib/nutrition-estimate';

interface NutritionEstimateBody {
  description?: string;
  mealType?: string;
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

    const parsed = parseNutritionEstimate(content);
    return NextResponse.json({ estimate: parsed, source: 'ai' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'manual' }, { status: 502 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Nutrition estimate failed';
}
