import type { AgentContext, AgentFindingDto, AgentResult, StrategyResult } from '@/lib/agents/types';
import type { ToolCallDraft } from '@/lib/mcp/types';

export async function runStrategyAgent(context: AgentContext, specialistResults: AgentResult[], mode: 'daily' | 'weekly' | 'chat'): Promise<StrategyResult> {
  const allFindings = specialistResults.flatMap(result => result.findings);
  const actionFindings = allFindings.filter(finding => finding.severity === 'action');
  const warningFindings = allFindings.filter(finding => finding.severity === 'warning');
  const proposalLimit = mode === 'weekly' ? 3 : 1;
  const proposalDrafts = dedupeProposalDrafts(specialistResults.flatMap(result => result.proposalDrafts)).slice(0, proposalLimit);
  const plateauAssessment = context.predictions?.plateau.status === 'possible'
    ? context.predictions.plateau.reason
    : '当前没有足够证据判断为平台期，继续观察 7-14 天平均体重更稳妥。';
  const topFinding = actionFindings[0] || warningFindings[0] || allFindings[0];
  const finding: AgentFindingDto = {
    id: 'strategy-summary',
    agent: 'strategy',
    type: context.predictions?.plateau.status === 'possible' ? 'plateau' : 'strategy',
    severity: actionFindings.length ? 'action' : warningFindings.length ? 'warning' : 'info',
    title: actionFindings.length ? '今天优先处理一个关键动作' : '当前策略以稳定执行为主',
    summary: topFinding
      ? `优先关注：${topFinding.title}。${topFinding.summary}`
      : '当前没有明显风险，继续保持记录、蛋白质和训练节奏。',
    evidence: {
      specialistAgents: specialistResults.map(result => ({ agent: result.agent, score: result.score, confidence: result.confidence })),
      plateau: context.predictions?.plateau,
    },
    confidence: specialistResults.some(result => result.confidence === 'high') ? 'medium' : 'low',
    recommendedActions: proposalDrafts.map((draft, index) => ({
      actionType: draft.toolName,
      priority: (Math.min(index + 1, 3) as 1 | 2 | 3),
      arguments: draft.arguments,
      reason: draft.reason,
    })),
  };

  return {
    agent: 'strategy',
    score: Math.round(specialistResults.reduce((sum, result) => sum + (result.score ?? 70), 0) / Math.max(1, specialistResults.length)),
    findings: [finding],
    proposalDrafts,
    memoryWrites: buildMemoryWrites(context, allFindings),
    confidence: finding.confidence,
    strategySummary: finding.summary,
    plateauAssessment,
    priorities: [topFinding?.title || '保持记录完整度'].filter(Boolean),
  };
}

function dedupeProposalDrafts(drafts: ToolCallDraft[]) {
  const seen = new Set<string>();
  const result: ToolCallDraft[] = [];
  for (const draft of drafts) {
    const key = `${draft.toolName}:${JSON.stringify(draft.arguments)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(draft);
  }
  return result;
}

function buildMemoryWrites(context: AgentContext, findings: AgentFindingDto[]) {
  const actionFinding = findings.find(finding => finding.severity === 'action');
  if (!actionFinding) return [];
  return [{
    userId: context.user.id,
    agent: actionFinding.agent,
    type: `${actionFinding.type}_pattern` as 'nutrition_pattern' | 'training_pattern' | 'recovery_pattern',
    title: actionFinding.title,
    content: { finding: actionFinding.summary, evidence: actionFinding.evidence },
    confidence: actionFinding.confidence === 'high' ? 0.8 : 0.55,
    source: 'agent_strategy',
  }];
}
