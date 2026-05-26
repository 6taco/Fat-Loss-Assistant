import type { AgentContext, AgentFindingDto, AgentResult } from '@/lib/agents/types';

export async function runTrainingAgent(context: AgentContext): Promise<AgentResult> {
  const upcoming = context.plans.filter(plan => plan.date >= context.date).slice(0, 7);
  const findings: AgentFindingDto[] = [];
  const highCarbMismatch = upcoming.filter(plan => (
    plan.carbType === 'high' && plan.muscleGroup !== 'legs' && plan.muscleGroup !== 'back'
  ));
  const trainingDays = upcoming.filter(plan => plan.muscleGroup && plan.muscleGroup !== 'rest');
  const restDays = upcoming.filter(plan => !plan.muscleGroup || plan.muscleGroup === 'rest');

  if (!upcoming.length) {
    findings.push({
      id: 'training-no-plan',
      agent: 'training',
      type: 'training',
      severity: 'warning',
      title: '未来训练计划不足',
      summary: '接下来 7 天还没有足够训练安排，建议先生成一版基础训练计划。',
      evidence: { upcomingPlanDays: 0 },
      confidence: 'high',
      recommendedActions: [{
        actionType: 'generate_training_plan',
        priority: 1,
        arguments: { userId: context.user.id, startDate: context.date, days: 7 },
        reason: '缺少未来训练安排。',
      }],
    });
  } else if (highCarbMismatch.length >= 2) {
    findings.push({
      id: 'training-carb-mismatch',
      agent: 'training',
      type: 'training',
      severity: 'action',
      title: '高碳日和训练强度不够匹配',
      summary: '未来一周有多个高碳日没有匹配腿或背等大肌群训练，建议重排碳循环。',
      evidence: { mismatchDates: highCarbMismatch.map(plan => plan.date) },
      confidence: 'high',
      recommendedActions: [{
        actionType: 'reorder_carb_cycle',
        priority: 1,
        arguments: { userId: context.user.id, startDate: context.date, days: 7 },
        reason: '高碳日应优先匹配大肌群或高强度训练。',
      }],
    });
  }

  if (trainingDays.length >= 6 && restDays.length === 0) {
    findings.push({
      id: 'training-recovery-risk',
      agent: 'training',
      type: 'recovery',
      severity: 'warning',
      title: '未来一周恢复日偏少',
      summary: '训练安排较密集，建议至少保留 1 天低强度或恢复日。',
      evidence: { trainingDays: trainingDays.length, restDays: restDays.length },
      confidence: 'medium',
      recommendedActions: [],
    });
  }

  if (!findings.length) {
    findings.push({
      id: 'training-stable',
      agent: 'training',
      type: 'training',
      severity: 'info',
      title: '训练和碳循环匹配度正常',
      summary: '未来训练安排没有明显冲突，高碳日与训练强度整体匹配。',
      evidence: { trainingDays: trainingDays.length, restDays: restDays.length },
      confidence: upcoming.length ? 'medium' : 'low',
      recommendedActions: [],
    });
  }

  return {
    agent: 'training',
    score: scoreTraining(upcoming.length, highCarbMismatch.length, restDays.length),
    findings,
    proposalDrafts: findings.flatMap(finding => finding.recommendedActions)
      .filter(action => action.actionType !== 'none' && action.arguments)
      .map(action => ({
        toolName: action.actionType as 'generate_training_plan' | 'reorder_carb_cycle',
        arguments: action.arguments || {},
        reason: action.reason,
        confidence: 0.75,
      })),
    memoryWrites: [],
    confidence: upcoming.length ? 'high' : 'medium',
  };
}

function scoreTraining(upcomingDays: number, mismatchCount: number, restDays: number) {
  if (!upcomingDays) return 35;
  let score = 85;
  score -= mismatchCount * 15;
  if (restDays === 0) score -= 10;
  return Math.max(0, Math.min(100, score));
}
