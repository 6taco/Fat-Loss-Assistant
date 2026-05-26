import { Prisma } from '@prisma/client';
import { getShanghaiDate } from '@/lib/daily-report';
import { getPrisma } from '@/lib/prisma';
import { buildAgentContext } from '@/lib/agents/context';
import { runCoachAgent } from '@/lib/agents/coach-agent';
import { runNutritionAgent } from '@/lib/agents/nutrition-agent';
import { runRecoveryAgent } from '@/lib/agents/recovery-agent';
import { runStrategyAgent } from '@/lib/agents/strategy-agent';
import { runTrainingAgent } from '@/lib/agents/training-agent';
import type { AgentFindingDto, AgentResult, AgentRunType, RunAgentWorkflowInput, RunAgentWorkflowResult } from '@/lib/agents/types';
import type { ToolCallDraft } from '@/lib/mcp/types';

export async function runAgentWorkflow(input: RunAgentWorkflowInput): Promise<RunAgentWorkflowResult> {
  const prisma = getPrisma();
  const date = input.date || getShanghaiDate();
  const run = await prisma.agentRun.create({
    data: {
      userId: input.userId,
      runType: input.runType,
      status: 'running',
      input: input as unknown as Prisma.InputJsonValue,
    },
  });

  try {
    const context = await buildAgentContext(input.userId, { date, runType: input.runType });
    await logAgentMessage(run.id, input.userId, 'orchestrator', 'broadcast', 'context', { date, runType: input.runType }, 'high');

    const specialistResults = await runSpecialists(context, input.runType, input.intent);
    for (const result of specialistResults) {
      await logAgentMessage(run.id, input.userId, result.agent, 'strategy', 'analysis_result', result, result.confidence);
    }

    const strategy = await runStrategyAgent(context, specialistResults, input.runType === 'weekly' ? 'weekly' : input.runType === 'chat' ? 'chat' : 'daily');
    await logAgentMessage(run.id, input.userId, 'strategy', 'coach', 'strategy_result', strategy, strategy.confidence);

    const coach = await runCoachAgent(context, specialistResults, strategy, {
      message: input.message,
      mode: input.runType === 'weekly' ? 'weekly' : input.runType === 'chat' ? 'chat' : 'daily',
    });
    await logAgentMessage(run.id, input.userId, 'coach', 'orchestrator', 'coach_response_result', coach, coach.confidence);

    const allFindings = [...specialistResults.flatMap(result => result.findings), ...strategy.findings, ...coach.findings];
    await persistFindings(run.id, input.userId, allFindings);
    await persistMemories(input.userId, [...specialistResults.flatMap(result => result.memoryWrites), ...strategy.memoryWrites]);
    const proposals = await persistProposals(input.userId, strategy.proposalDrafts);
    await persistCoachInsight(input.userId, date, coach.insight);

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        output: { findings: allFindings, proposals: proposals.map(proposal => proposal.id), coachMessage: coach.message } as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });

    return {
      runId: run.id,
      status: 'completed',
      findings: allFindings,
      proposals,
      coachMessage: coach,
    };
  } catch (error) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Agent workflow failed',
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

async function runSpecialists(context: Awaited<ReturnType<typeof buildAgentContext>>, runType: AgentRunType, intent?: string) {
  const tasks: Array<Promise<AgentResult>> = [];
  if (runType === 'daily' || runType === 'weekly' || intent === 'nutrition' || intent === 'plateau' || intent === 'general') tasks.push(runNutritionAgent(context));
  if (runType === 'daily' || runType === 'weekly' || intent === 'training' || intent === 'plateau') tasks.push(runTrainingAgent(context));
  if (runType === 'daily' || runType === 'weekly' || intent === 'recovery' || intent === 'plateau') tasks.push(runRecoveryAgent(context));
  if (!tasks.length) tasks.push(runNutritionAgent(context));

  const settled = await Promise.allSettled(tasks);
  return settled.map((result, index): AgentResult => {
    if (result.status === 'fulfilled') return result.value;
    return {
      agent: index === 0 ? 'nutrition' : index === 1 ? 'training' : 'recovery',
      findings: [{
        id: `agent-error-${index}`,
        agent: index === 0 ? 'nutrition' : index === 1 ? 'training' : 'recovery',
        type: 'strategy',
        severity: 'warning',
        title: '部分 Agent 暂时不可用',
        summary: '本次分析已跳过一个失败的专家 Agent，其余结果仍可参考。',
        evidence: { error: result.reason instanceof Error ? result.reason.message : String(result.reason) },
        confidence: 'low',
        recommendedActions: [],
      }],
      proposalDrafts: [],
      memoryWrites: [],
      confidence: 'low',
    };
  });
}

async function persistFindings(runId: string, userId: string, findings: AgentFindingDto[]) {
  const prisma = getPrisma();
  if (!findings.length) return;
  await prisma.agentFinding.createMany({
    data: findings.map(finding => ({
      runId,
      userId,
      agent: finding.agent,
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      summary: finding.summary,
      evidence: {
        evidence: finding.evidence,
        recommendedActions: finding.recommendedActions,
      } as unknown as Prisma.InputJsonValue,
      confidence: finding.confidence,
    })),
  });
}

async function persistMemories(userId: string, memories: AgentResult['memoryWrites']) {
  const prisma = getPrisma();
  for (const memory of memories.slice(0, 3)) {
    await prisma.agentMemory.create({
      data: {
        userId,
        agent: memory.agent,
        type: memory.type,
        title: memory.title,
        content: memory.content as unknown as Prisma.InputJsonValue,
        confidence: memory.confidence,
        source: memory.source,
      },
    }).catch(() => null);
  }
}

async function persistProposals(userId: string, drafts: ToolCallDraft[]) {
  const prisma = getPrisma();
  const proposals = [];
  for (const draft of drafts) {
    const title = proposalTitle(draft);
    const existing = await prisma.actionProposal.findFirst({
      where: { userId, type: draft.toolName, status: 'pending', title },
    });
    if (existing) {
      proposals.push(existing);
      continue;
    }
    const proposal = await prisma.actionProposal.create({
      data: {
        userId,
        type: draft.toolName,
        status: 'pending',
        title,
        summary: draft.reason,
        payload: draft.arguments as unknown as Prisma.InputJsonValue,
        reason: { source: 'multi_agent_strategy', confidence: draft.confidence } as unknown as Prisma.InputJsonValue,
        safety: { requiresUserConfirmation: true, risk: draft.toolName === 'update_calorie_target' || draft.toolName === 'reorder_carb_cycle' ? 'medium' : 'low' } as unknown as Prisma.InputJsonValue,
        toolName: draft.toolName,
        executionState: 'pending_confirmation',
        diffPreview: { before: draft.beforeSnapshot || {}, after: draft.afterPreview || draft.arguments } as unknown as Prisma.InputJsonValue,
      },
    });
    proposals.push(proposal);
  }
  return proposals;
}

async function persistCoachInsight(userId: string, date: string, insight: { type: string; severity: string; title: string; summary: string; evidence: unknown }) {
  const prisma = getPrisma();
  await prisma.coachInsight.create({
    data: {
      userId,
      date: new Date(`${date}T00:00:00`),
      type: insight.type,
      severity: insight.severity,
      title: insight.title,
      summary: insight.summary,
      evidence: insight.evidence as unknown as Prisma.InputJsonValue,
    },
  });
}

async function logAgentMessage(
  runId: string,
  userId: string,
  fromAgent: string,
  toAgent: string,
  messageType: string,
  payload: unknown,
  confidence: string,
) {
  const prisma = getPrisma();
  await prisma.agentMessage.create({
    data: {
      runId,
      userId,
      fromAgent,
      toAgent,
      messageType,
      payload: payload as unknown as Prisma.InputJsonValue,
      confidence,
      evidenceRefs: [] as unknown as Prisma.InputJsonValue,
    },
  }).catch(() => null);
}

function proposalTitle(draft: ToolCallDraft) {
  if (draft.toolName === 'generate_meal_plan') return '生成饮食计划';
  if (draft.toolName === 'generate_training_plan') return '生成训练计划';
  if (draft.toolName === 'reorder_carb_cycle') return '重排碳循环';
  if (draft.toolName === 'update_calorie_target') return '调整热量目标';
  if (draft.toolName === 'create_shopping_list') return '生成采购清单';
  return '更新目标体重';
}
