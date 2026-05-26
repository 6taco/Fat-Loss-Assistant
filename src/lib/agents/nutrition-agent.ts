import { calculateMealCalories } from '@/lib/mock-data';
import type { AgentContext, AgentFindingDto, AgentResult } from '@/lib/agents/types';

export async function runNutritionAgent(context: AgentContext): Promise<AgentResult> {
  const todayPlan = context.plans.find(plan => plan.date === context.date);
  const todayMeals = context.meals.filter(meal => meal.date === context.date);
  const calories = todayMeals.reduce((sum, meal) => sum + (meal.calories ?? calculateMealCalories(meal)), 0);
  const protein = todayMeals.reduce((sum, meal) => sum + meal.protein, 0);
  const calorieRate = todayPlan?.calories ? calories / todayPlan.calories : undefined;
  const proteinRate = todayPlan?.protein ? protein / todayPlan.protein : undefined;
  const findings: AgentFindingDto[] = [];

  if (!todayMeals.length) {
    findings.push({
      id: 'nutrition-no-meals',
      agent: 'nutrition',
      type: 'nutrition',
      severity: 'warning',
      title: '今天还没有饮食记录',
      summary: '先补一餐记录就能让教练更准确地判断热量和蛋白质执行情况。',
      evidence: { mealCount: 0, date: context.date },
      confidence: 'high',
      recommendedActions: [],
    });
  }

  if (proteinRate !== undefined && proteinRate < 0.8) {
    findings.push({
      id: 'nutrition-low-protein',
      agent: 'nutrition',
      type: 'nutrition',
      severity: 'action',
      title: '蛋白质完成率偏低',
      summary: `今天蛋白约 ${Math.round(protein)}g，低于目标 ${todayPlan?.protein ?? 0}g，建议优先补一份高蛋白食物。`,
      evidence: { protein, target: todayPlan?.protein, proteinRate },
      confidence: 'high',
      recommendedActions: [{
        actionType: 'generate_meal_plan',
        priority: 1,
        arguments: { userId: context.user.id, startDate: context.date, days: 3 },
        reason: '蛋白质完成率低于 80%，生成餐单可以降低明天继续不足的概率。',
      }],
    });
  }

  if (calorieRate !== undefined && calorieRate > 1.2) {
    findings.push({
      id: 'nutrition-high-calorie',
      agent: 'nutrition',
      type: 'adherence',
      severity: 'action',
      title: '今天热量明显偏高',
      summary: `今天热量约 ${Math.round(calories)} kcal，已经超过目标 20%，明天正常拉回节奏即可。`,
      evidence: { calories, target: todayPlan?.calories, calorieRate },
      confidence: 'high',
      recommendedActions: [],
    });
  }

  if (!findings.length) {
    findings.push({
      id: 'nutrition-stable',
      agent: 'nutrition',
      type: 'nutrition',
      severity: 'info',
      title: '饮食执行整体稳定',
      summary: '今天的饮食记录没有明显风险，继续优先保证蛋白质和记录完整度。',
      evidence: { calories, protein, calorieRate, proteinRate },
      confidence: todayMeals.length ? 'medium' : 'low',
      recommendedActions: [],
    });
  }

  return {
    agent: 'nutrition',
    score: scoreNutrition(Boolean(todayMeals.length), calorieRate, proteinRate),
    findings,
    proposalDrafts: findings.flatMap(finding => finding.recommendedActions)
      .filter(action => action.actionType !== 'none' && action.arguments)
      .map(action => ({
        toolName: action.actionType as 'generate_meal_plan',
        arguments: action.arguments || {},
        reason: action.reason,
        confidence: 0.75,
      })),
    memoryWrites: [],
    confidence: todayPlan ? 'high' : 'medium',
  };
}

function scoreNutrition(hasMeals: boolean, calorieRate?: number, proteinRate?: number) {
  let score = hasMeals ? 35 : 10;
  if (calorieRate === undefined) score += 20;
  else if (calorieRate >= 0.8 && calorieRate <= 1.1) score += 35;
  else if (calorieRate <= 1.2) score += 25;
  else score += 12;

  if (proteinRate === undefined) score += 15;
  else if (proteinRate >= 0.9) score += 30;
  else if (proteinRate >= 0.75) score += 20;
  else score += 8;

  return Math.max(0, Math.min(100, score));
}
