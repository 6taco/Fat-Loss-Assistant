import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { askDeepSeek, toDeepSeekMessages } from '@/lib/deepseek';
import { answerWithRag } from '@/lib/rag/answer';
import { shouldUseRag } from '@/lib/rag/intent';
import { getPrisma } from '@/lib/prisma';
import { toolRegistry } from '@/lib/mcp/registry';
import { buildIdempotencyKey, ensureUserExists, isToolCallSafe } from '@/lib/mcp/policy';
import { runAgentWorkflow } from '@/lib/agents/orchestrator';
import type { AgentIntent } from '@/lib/agents/types';
import type { ChatMessage } from '@/lib/mock-data';

interface ChatRequestBody {
  message?: string;
  history?: ChatMessage[];
  context?: {
    user?: { id?: string };
    todayPlan?: unknown;
    recentWeights?: unknown[];
    completed?: boolean;
  };
}

const TOOL_RULES: Array<{ keyword: RegExp; toolName: keyof typeof toolRegistry }> = [
  { keyword: /(目标体重|体重目标|改目标|更新目标|goal weight)/i, toolName: 'update_weight_goal' },
  { keyword: /(热量|卡路里|calorie|kcal|调整热量)/i, toolName: 'update_calorie_target' },
  { keyword: /(餐单|饮食计划|吃什么|meal plan)/i, toolName: 'generate_meal_plan' },
  { keyword: /(训练计划|训练安排|健身计划|training plan)/i, toolName: 'generate_training_plan' },
  { keyword: /(碳循环|高碳|中碳|低碳|重排)/i, toolName: 'reorder_carb_cycle' },
  { keyword: /(采购清单|购物清单|买什么|shopping list)/i, toolName: 'create_shopping_list' },
];

export async function POST(request: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  try {
    const message = body.message?.trim();
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const history = Array.isArray(body.history) ? body.history : [];
    const userId = body.context?.user?.id;
    const conversationQuestion = buildConversationQuestion(message, history);

    const ragResponse = await tryRagAnswer(conversationQuestion, message, body.context, userId);
    if (ragResponse) return NextResponse.json(ragResponse);

    const toolName = inferToolName(message);
    if (toolName && userId) {
      const toolResponse = await tryToolProposal({ userId, toolName, question: message });
      if (toolResponse) return NextResponse.json(toolResponse);
    }

    const agentIntent = shouldUseAgentForChat(message) ? inferAgentIntent(message) : null;
    if (agentIntent && userId) {
      const agentResponse = await tryAgentAnswer({ userId, intent: agentIntent, message });
      if (agentResponse) return NextResponse.json(agentResponse);
    }

    const deepSeekResponse = await tryDeepSeekAnswer(history, conversationQuestion, body.context);
    return NextResponse.json(deepSeekResponse);
  } catch (error) {
    return NextResponse.json({
      source: 'fallback',
      warning: error instanceof Error ? error.message : 'Chat route failed',
      message: buildFallbackMessage('聊天服务刚才遇到异常，但应用不会中断。请稍后再试，或先换一个更具体的问题。'),
    });
  }
}

async function tryRagAnswer(question: string, originalMessage: string, context: ChatRequestBody['context'], userId?: string) {
  if (!shouldUseRag(question)) return null;

  try {
    const rag = await answerWithRag({
      question,
      context: {
        ...context,
        originalMessage,
      },
      userId,
    });
    if (rag.confidence === 'low') return null;

    return {
      source: 'rag',
      message: {
        id: `ai-rag-${Date.now()}`,
        role: 'ai',
        content: rag.answer,
        timestamp: new Date().toISOString(),
        cards: rag.citations.length
          ? [{
              type: 'suggestion',
              title: '知识库引用',
              items: rag.citations.slice(0, 3).map(citation => ({
                label: citation.label,
                value: `${citation.title} · ${citation.authority}${citation.year ? ` · ${citation.year}` : ''}`,
              })),
            }]
          : undefined,
      },
      citations: rag.citations,
      confidence: rag.confidence,
    };
  } catch {
    return null;
  }
}

async function tryToolProposal(input: { userId: string; toolName: keyof typeof toolRegistry; question: string }) {
  try {
    return await createToolProposal(input);
  } catch {
    return {
      source: 'tool',
      message: buildFallbackMessage('我暂时没能创建待确认动作，但可以先用文字帮你分析。请确认个人资料已经同步到数据库。'),
    };
  }
}

async function tryAgentAnswer(input: { userId: string; intent: AgentIntent; message: string }) {
  try {
    const agentResult = await runAgentWorkflow({
      userId: input.userId,
      runType: 'chat',
      intent: input.intent,
      message: input.message,
    });

    if (!agentResult.coachMessage) return null;

    return {
      source: 'multi_agent',
      runId: agentResult.runId,
      findings: agentResult.findings,
      message: {
        id: `ai-agent-${Date.now()}`,
        role: 'ai',
        content: agentResult.coachMessage.message,
        timestamp: new Date().toISOString(),
        cards: agentResult.coachMessage.cards,
      },
    };
  } catch {
    return null;
  }
}

async function tryDeepSeekAnswer(history: ChatMessage[], message: string, context: ChatRequestBody['context']) {
  try {
    const content = await askDeepSeek(toDeepSeekMessages(history, message, JSON.stringify(context ?? {}, null, 2)));
    return {
      source: 'deepseek',
      message: {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content,
        timestamp: new Date().toISOString(),
      },
    };
  } catch {
    return {
      source: 'fallback',
      message: buildFallbackMessage('AI 服务暂时不可用，但我先给你一个稳妥方向：不要基于单日波动大幅调整。先继续记录体重、饮食和训练完成情况。'),
    };
  }
}

function inferToolName(message: string) {
  if (!isExplicitActionRequest(message)) return null;

  for (const rule of TOOL_RULES) {
    if (rule.keyword.test(message)) return rule.toolName;
  }
  return null;
}

function buildConversationQuestion(message: string, history: ChatMessage[]) {
  if (!isFollowUpQuestion(message)) return message;

  const lastUserMessage = [...history].reverse().find(item => item.role === 'user' && item.content.trim());
  if (!lastUserMessage) return message;

  return `上一轮主题：${lastUserMessage.content.trim()}\n当前追问：${message}\n请沿着上一轮主题继续回答，不要把追问当成全新的减脂泛泛问题。`;
}

function isFollowUpQuestion(message: string) {
  return /^(还有|还有什么|其他|其它|还有没有|那还有|继续|再说|展开|具体点|为什么|那怎么办|怎么做|还有啥|还有哪些)/.test(message.trim())
    || /(其它方法|其他方法|还有方法|还有建议|继续说|接着说|再详细|再具体)/.test(message);
}

function isExplicitActionRequest(message: string) {
  return /(\u8c03\u6574|\u4fee\u6539|\u66f4\u6539|\u751f\u6210|\u5236\u5b9a|\u521b\u5efa|\u5b89\u6392|\u91cd\u6392|\u8bbe\u7f6e|\u66f4\u65b0|\u6267\u884c|\u786e\u8ba4|\u6539\u6210|\u6362\u6210|\u505a\u4e00\u4efd|\u505a\u4e00\u4e2a)/i.test(message)
    || /(\u5e2e\u6211|\u7ed9\u6211).*(\u8c03\u6574|\u4fee\u6539|\u66f4\u6539|\u751f\u6210|\u5236\u5b9a|\u521b\u5efa|\u5b89\u6392|\u91cd\u6392|\u8bbe\u7f6e|\u66f4\u65b0|\u505a\u4e00\u4efd|\u505a\u4e00\u4e2a)/i.test(message);
}

function inferAgentIntent(message: string): AgentIntent | null {
  if (/(饮食|蛋白|热量|碳水|脂肪|吃什么|餐|nutrition)/i.test(message)) return 'nutrition';
  if (/(训练|肌群|力量|有氧|健身|training)/i.test(message)) return 'training';
  if (/(睡眠|恢复|疲劳|压力|休息|recovery)/i.test(message)) return 'recovery';
  if (/(平台期|不掉秤|停滞|plateau)/i.test(message)) return 'plateau';
  if (/(策略|下周|长期|计划|strategy)/i.test(message)) return 'strategy';
  return null;
}

function shouldUseAgentForChat(message: string) {
  return /(我的|帮我分析|根据我的|平台期|不掉秤|长期策略|下周策略|复盘|数据|趋势)/i.test(message);
}

async function createToolProposal(input: { userId: string; toolName: keyof typeof toolRegistry; question: string }) {
  const prisma = getPrisma();
  const user = await ensureUserExists(input.userId);
  const tool = toolRegistry[input.toolName];
  const args = buildToolArguments(input.toolName, input.question, input.userId, user);
  const safe = isToolCallSafe(input.toolName, args);

  if (!safe.ok) {
    return {
      source: 'tool',
      message: buildFallbackMessage(safe.error || '这个动作参数还不完整，我需要你补充一点信息。'),
    };
  }

  const parsedArgs = safe.parsed as Record<string, unknown>;
  const idempotencyKey = buildIdempotencyKey(input.toolName, parsedArgs);
  const existing = await prisma.actionProposal.findFirst({
    where: { userId: input.userId, type: input.toolName, status: 'pending' },
  });

  if (existing) {
    return {
      source: 'tool',
      pending_tool_proposals: [proposalShape(existing)],
      message: {
        id: `ai-tool-${Date.now()}`,
        role: 'ai',
        content: `我已经为你准备好一个待确认建议：${existing.title}。`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const proposal = await prisma.actionProposal.create({
    data: {
      userId: input.userId,
      type: input.toolName,
      status: 'pending',
      title: buildToolTitle(input.toolName, parsedArgs),
      summary: input.question,
      payload: parsedArgs as Prisma.InputJsonValue,
      reason: { source: 'planner', question: input.question } as Prisma.InputJsonValue,
      safety: {
        requiresUserConfirmation: true,
        risk: tool.riskLevel,
        idempotencyKey,
      } as Prisma.InputJsonValue,
      toolName: input.toolName,
      executionState: 'pending_confirmation',
      diffPreview: {
        before: {},
        after: parsedArgs,
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.toolInvocationLog.create({
    data: {
      userId: input.userId,
      toolName: input.toolName,
      proposalId: proposal.id,
      idempotencyKey,
      mode: 'tool',
      rawInput: { question: input.question, userId: input.userId } as Prisma.InputJsonValue,
      parsedInput: parsedArgs as Prisma.InputJsonValue,
      status: 'received',
    },
  }).catch(() => null);

  return {
    source: 'tool',
    pending_tool_proposals: [proposalShape(proposal)],
    message: {
      id: `ai-tool-${Date.now()}`,
      role: 'ai',
      content: `我已经生成一个待确认动作：${proposal.title}。确认后才会执行。`,
      timestamp: new Date().toISOString(),
    },
  };
}

function proposalShape(proposal: {
  id: string;
  toolName: string | null;
  title: string;
  summary: string;
  payload: unknown;
  reason: unknown;
  safety: unknown;
  diffPreview: unknown;
  executionState: string | null;
}) {
  return {
    id: proposal.id,
    toolName: proposal.toolName,
    title: proposal.title,
    summary: proposal.summary,
    payload: proposal.payload,
    reason: proposal.reason,
    safety: proposal.safety,
    diffPreview: proposal.diffPreview,
    executionState: proposal.executionState,
  };
}

function buildToolArguments(
  toolName: keyof typeof toolRegistry,
  question: string,
  userId: string,
  user: { goalWeight: number; weight: number },
) {
  const today = new Date().toISOString().slice(0, 10);

  if (toolName === 'update_weight_goal') {
    const match = question.match(/(\d+(?:\.\d+)?)\s*(kg|公斤|斤)?/i);
    const raw = match ? Number(match[1]) : Math.round(user.goalWeight || user.weight * 0.9);
    const goalWeight = match?.[2] === '斤' ? raw / 2 : raw;
    return { userId, goalWeight, reason: question };
  }

  if (toolName === 'update_calorie_target') return { userId, startDate: today, days: 7, calorieDelta: -100 };
  if (toolName === 'generate_meal_plan') return { userId, startDate: today, days: 3 };
  if (toolName === 'generate_training_plan') return { userId, startDate: today, days: 7 };
  if (toolName === 'reorder_carb_cycle') return { userId, startDate: today, days: 7 };
  return { userId, startDate: today, days: 3 };
}

function buildToolTitle(toolName: keyof typeof toolRegistry, args: Record<string, unknown>) {
  if (toolName === 'update_weight_goal') return `更新目标体重到 ${args.goalWeight}kg`;
  if (toolName === 'update_calorie_target') return '调整热量目标';
  if (toolName === 'generate_meal_plan') return '生成饮食计划';
  if (toolName === 'generate_training_plan') return '生成训练计划';
  if (toolName === 'reorder_carb_cycle') return '重排碳循环';
  return '生成采购清单';
}

function buildFallbackMessage(content: string) {
  return {
    id: `ai-fallback-${Date.now()}`,
    role: 'ai',
    content,
    timestamp: new Date().toISOString(),
  };
}
