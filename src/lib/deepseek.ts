import { ChatMessage } from '@/lib/mock-data';

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const COACH_ZERO_SYSTEM_PROMPT = `你是 Coach Zero，一位专业、克制、数据驱动但有温度的 AI 减脂教练。
产品场景是“减脂助手”，用户正在执行经典碳循环方案。

回答要求：
1. 必须使用中文。
2. 不做医疗诊断，不承诺具体疗效。
3. 优先围绕热量、碳循环、蛋白质、训练、睡眠、压力管理给建议。
4. 如果用户问“今天吃什么”，给出三餐和加餐建议。
5. 如果用户问平台期、反弹、饥饿、欺骗餐，给结构化策略。
6. 每次回答尽量包含 2-4 个行动点。
7. 不要输出 Markdown 表格，移动端阅读要短句、清晰、可执行。`;

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

  return [
    { role: 'system', content: COACH_ZERO_SYSTEM_PROMPT },
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

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
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
  });

  const data = (await response.json()) as DeepSeekResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || `DeepSeek request failed: ${response.status}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('DeepSeek returned empty content');
  }

  return content;
}
