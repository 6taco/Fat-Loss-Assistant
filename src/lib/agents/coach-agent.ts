import type { AgentContext, AgentFindingDto, AgentResult, CoachAgentResult, StrategyResult } from '@/lib/agents/types';

export async function runCoachAgent(
  context: AgentContext,
  specialistResults: AgentResult[],
  strategy: StrategyResult,
  options: { message?: string; mode: 'daily' | 'weekly' | 'chat' },
): Promise<CoachAgentResult> {
  const allFindings = [...specialistResults.flatMap(result => result.findings), ...strategy.findings];
  const primary = pickPrimaryFinding(allFindings);
  const proposalCount = strategy.proposalDrafts.length;
  const message = buildMessage(primary, strategy, proposalCount, options);
  const cards = [{
    type: 'suggestion' as const,
    title: '多 Agent 分析',
    items: specialistResults.map(result => ({
      label: agentLabel(result.agent),
      value: `${result.score ?? '--'} 分 · ${confidenceLabel(result.confidence)}`,
    })),
  }];

  return {
    agent: 'coach',
    score: strategy.score,
    findings: [{
      id: 'coach-final',
      agent: 'coach',
      type: primary.type,
      severity: primary.severity,
      title: primary.title,
      summary: message,
      evidence: { primaryFinding: primary, strategy: strategy.strategySummary },
      confidence: strategy.confidence,
      recommendedActions: strategy.findings[0]?.recommendedActions || [],
    }],
    proposalDrafts: [],
    memoryWrites: [],
    confidence: strategy.confidence,
    message,
    cards,
    insight: {
      type: primary.type,
      severity: primary.severity,
      title: primary.title,
      summary: message,
      evidence: { agents: specialistResults.map(result => result.agent), strategy: strategy.strategySummary },
    },
  };
}

function pickPrimaryFinding(findings: AgentFindingDto[]) {
  return findings.find(finding => finding.severity === 'action')
    || findings.find(finding => finding.severity === 'warning')
    || findings[0]
    || {
      id: 'coach-empty',
      agent: 'coach' as const,
      type: 'motivation' as const,
      severity: 'info' as const,
      title: '今天先保持稳定执行',
      summary: '目前没有明显风险，继续记录饮食、体重和训练即可。',
      evidence: {},
      confidence: 'low' as const,
      recommendedActions: [],
    };
}

function buildMessage(primary: AgentFindingDto, strategy: StrategyResult, proposalCount: number, options: { mode: 'daily' | 'weekly' | 'chat'; message?: string }) {
  const prefix = options.mode === 'weekly' ? '本周策略结论：' : options.mode === 'chat' ? '我的判断是：' : '今日教练结论：';
  const proposalText = proposalCount > 0 ? `我已准备 ${proposalCount} 个待确认动作，确认后才会执行。` : '暂时不需要改计划，先把当前节奏稳住。';
  return `${prefix}${primary.summary} ${proposalText} ${strategy.plateauAssessment}`;
}

function agentLabel(agent: AgentResult['agent']) {
  if (agent === 'nutrition') return '饮食';
  if (agent === 'training') return '训练';
  if (agent === 'recovery') return '恢复';
  if (agent === 'strategy') return '策略';
  return '教练';
}

function confidenceLabel(confidence: string) {
  if (confidence === 'high') return '高置信';
  if (confidence === 'medium') return '中置信';
  return '低置信';
}
