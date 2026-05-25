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
          '你是 Fat Loss Assistant 的营养估算助手，只返回 JSON，不要 Markdown。',
          '根据中文食物描述估算每项食物的重量、热量、蛋白质、脂肪、碳水。',
          '支持中餐、西餐、轻食、奶茶、零食。奶茶要估算容量、糖量、小料和奶盖。',
          '不知道精确重量时按常见一人份保守估算，数值四舍五入到整数。',
          '输出格式：{"description":"餐食摘要","items":[{"name":"食物","amountText":"份量","weightGram":100,"calories":120,"carb":0,"protein":0,"fat":0}],"totals":{"calories":120,"carb":0,"protein":0,"fat":0},"confidence":0.7,"warnings":[]}',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `餐次：${body.mealType || '未指定'}\n食物：${description}`,
      },
    ]);

    const parsed = parseNutritionEstimate(content);
    return NextResponse.json({ estimate: parsed, source: 'ai', provider: 'deepseek' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'manual' }, { status: 502 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Nutrition estimate failed';
}
