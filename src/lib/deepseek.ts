import { ChatMessage } from '@/lib/types';
import { llmFetchJson } from '@/lib/llm-fetch';

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
// Report generation with large contexts regularly takes 5-15s; 30s bounds
// hung upstream connections without failing healthy long generations.
const DEEPSEEK_TIMEOUT_MS = 30_000;

const COACH_ZERO_SYSTEM_PROMPT = `你是 Coach Zero，一位温柔、稳定、专业的 AI 减脂教练。
产品场景是“轻燃AI”，用户正在执行由 App 推荐或选择的个性化减脂方案，可能包括碳循环、稳定热量缺口、高蛋白轻断食、训练优先等不同策略。减脂过程可能伴随饥饿、疲惫、焦虑、自责、挫败和想放弃，用户也会来找你寻求安慰。

核心风格：
1. 必须使用中文。
2. 先接住情绪，再稳定用户，最后才给建议。优先顺序是：共情理解 -> 降低自责 -> 给 1-3 个很小、低门槛的下一步。
3. 用户表达难受、焦虑、崩溃、想放弃、暴食、自责、体重波动时，不要先讲大道理，不要立刻纠正，不要用“你应该”“你必须”“坚持就是胜利”压迫用户。
4. 允许温柔地说：这很难、你不是失败、今天先把自己稳住、我们只处理下一小步。
5. 不羞辱、不恐吓、不制造身材焦虑，不过度强调自律，不把一次失控定义为失败。
6. 回复要短句、具体、适合移动端阅读，不要输出 Markdown 表格。

专业边界：
1. 不做医疗诊断，不承诺具体疗效。
2. 饮食和训练建议要保守，优先围绕当前策略、热量、蛋白质、训练、睡眠、压力管理；只有在用户明确执行碳循环或上下文提供碳循环计划时，才把碳循环作为核心建议。
3. 如果用户问“今天吃什么”，给出三餐和加餐建议，但先用一句话安定情绪。
4. 如果用户问平台期、反弹、饥饿、欺骗餐，先承认这很常见，再给结构化小策略。
5. 如果用户表达自伤、自杀、活不下去、极端绝望或可能伤害自己/他人，要温柔但明确地建议立刻联系身边可信任的人，并尽快联系当地紧急服务或心理危机支持；不要只给减脂建议。`;

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekChoice {
  message?: {
    content?: string;
  };
}

interface DeepSeekResponse {
  choices?: DeepSeekChoice[];
  error?: {
    message?: string;
  };
}

export function toDeepSeekMessages(messages: ChatMessage[], latestContent: string, context?: string): DeepSeekMessage[] {
  const history = messages.slice(-10).map((msg): DeepSeekMessage => ({
    role: msg.role === 'ai' ? 'assistant' : 'user',
    content: msg.content,
  }));

  let coachInstruction = '';
  if (context) {
    try {
      const parsedContext = JSON.parse(context) as { coach?: { name?: string } };
      if (parsedContext.coach?.name) {
        coachInstruction = `当前用户选择的 AI 教练是“教练${parsedContext.coach.name}”。请在回复中使用这个称呼，不要再使用 Coach Zero。`;
      }
    } catch {
      coachInstruction = '';
    }
  }

  return [
    { role: 'system', content: COACH_ZERO_SYSTEM_PROMPT },
    ...(coachInstruction ? [{ role: 'system' as const, content: coachInstruction }] : []),
    ...(context ? [{ role: 'system' as const, content: `当前用户上下文：\n${context}` }] : []),
    ...history,
    { role: 'user', content: latestContent },
  ];
}

export async function askDeepSeek(messages: DeepSeekMessage[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY');
  }

  const { ok, status, json } = await llmFetchJson(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 900,
      stream: false,
    }),
  }, { label: 'DeepSeek', timeoutMs: DEEPSEEK_TIMEOUT_MS });

  const data = json as DeepSeekResponse;

  if (!ok) {
    throw new Error(data.error?.message || `DeepSeek request failed: ${status}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('DeepSeek returned empty content');
  }

  return content;
}
