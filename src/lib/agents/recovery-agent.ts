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

  // Sleep habits come from the onboarding lifestyle profile the user filled
  // in — irregular sleep or frequent late nights slow recovery and blunt fat
  // loss regardless of training volume.
  const sleepIrregular = context.lifestyle?.sleepRegularity === 'irregular';
  if (sleepIrregular || context.lifestyle?.oftenStaysUpLate) {
    findings.push({
      id: 'recovery-sleep-habits',
      agent: 'recovery',
      type: 'recovery',
      severity: 'warning',
      title: '睡眠习惯可能拖慢恢复',
      summary: sleepIrregular
        ? '你反馈过睡眠时间不规律。睡眠不稳会影响食欲激素和水分平衡，先固定入睡时间比加训练更有价值。'
        : '你反馈过经常熬夜。尽量把入睡时间提前 30-60 分钟，对恢复和体重趋势都有帮助。',
      evidence: {
        sleepRegularity: context.lifestyle?.sleepRegularity,
        averageSleepHours: context.lifestyle?.averageSleepHours,
        oftenStaysUpLate: context.lifestyle?.oftenStaysUpLate,
        source: 'lifestyle_profile',
      },
      confidence: 'medium',
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
      summary: context.lifestyle
        ? '已结合你问卷中的睡眠与作息信息。当前恢复判断以训练密度、体重波动和作息习惯为参考。'
        : '当前缺少睡眠和疲劳记录，恢复判断以训练密度和体重波动为参考。',
      evidence: { recoveryDataCompleteness: context.lifestyle ? 0.5 : 0.35, trainingDays, restDays, weightSwing },
      confidence: context.lifestyle ? 'medium' : 'low',
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
