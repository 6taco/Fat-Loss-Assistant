import type { AgentContext, AgentFindingDto, AgentResult } from '@/lib/agents/types';

export async function runRecoveryAgent(context: AgentContext): Promise<AgentResult> {
  const recentWeights = context.weights.slice(-7);
  const upcoming = context.plans.filter(plan => plan.date >= context.date).slice(0, 7);
  const trainingDays = upcoming.filter(plan => plan.muscleGroup && plan.muscleGroup !== 'rest').length;
  const restDays = upcoming.length - trainingDays;
  const findings: AgentFindingDto[] = [];
  const weightSwing = recentWeights.length >= 2
    ? Math.abs(recentWeights[recentWeights.length - 1].weight - recentWeights[0].weight)
    : 0;

  if (upcoming.length && trainingDays >= 6 && restDays === 0) {
    findings.push({
      id: 'recovery-no-rest',
      agent: 'recovery',
      type: 'recovery',
      severity: 'warning',
      title: '恢复日偏少',
      summary: '未来一周训练密度较高，建议保留至少一天低强度恢复，避免疲劳影响体重趋势。',
      evidence: { trainingDays, restDays },
      confidence: 'medium',
      recommendedActions: [],
    });
  }

  if (weightSwing >= 1.2 && recentWeights.length >= 4) {
    findings.push({
      id: 'recovery-water-weight',
      agent: 'recovery',
      type: 'recovery',
      severity: 'info',
      title: '近期体重波动可能包含水重',
      summary: '短期体重波动较大，不建议只根据单日体重立刻下调热量。',
      evidence: { weightSwing, recentWeights },
      confidence: 'low',
      recommendedActions: [],
    });
  }

  if (!findings.length) {
    findings.push({
      id: 'recovery-limited-data',
      agent: 'recovery',
      type: 'recovery',
      severity: 'info',
      title: '恢复数据仍然有限',
      summary: '当前缺少睡眠和疲劳记录，恢复判断以训练密度和体重波动为参考。',
      evidence: { recoveryDataCompleteness: 0.35, trainingDays, restDays, weightSwing },
      confidence: 'low',
      recommendedActions: [],
    });
  }

  return {
    agent: 'recovery',
    score: scoreRecovery(trainingDays, restDays, weightSwing),
    findings,
    proposalDrafts: [],
    memoryWrites: [],
    confidence: 'low',
  };
}

function scoreRecovery(trainingDays: number, restDays: number, weightSwing: number) {
  let score = 70;
  if (trainingDays >= 6 && restDays === 0) score -= 20;
  if (weightSwing >= 1.2) score -= 10;
  return Math.max(0, Math.min(100, score));
}
