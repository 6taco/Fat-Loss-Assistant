import { NextRequest, NextResponse } from 'next/server';
import { askDeepSeek, toDeepSeekMessages } from '@/lib/deepseek';
import { ChatMessage } from '@/lib/mock-data';

interface ChatRequestBody {
  message?: string;
  history?: ChatMessage[];
  context?: {
    user?: unknown;
    todayPlan?: unknown;
    recentWeights?: unknown[];
    completed?: boolean;
  };
}

function formatContext(context: ChatRequestBody['context']): string {
  if (!context) return '';
  return JSON.stringify(context, null, 2);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const history = Array.isArray(body.history) ? body.history : [];
    const deepSeekMessages = toDeepSeekMessages(history, message, formatContext(body.context));
    const content = await askDeepSeek(deepSeekMessages);

    return NextResponse.json({
      message: {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown chat error';
    const status = message.includes('DEEPSEEK_API_KEY') ? 500 : 502;

    return NextResponse.json(
      {
        error: message,
        fallback: {
          id: `ai-fallback-${Date.now()}`,
          role: 'ai',
          content: 'Coach Zero 暂时无法连接 AI 服务。先给你一个稳妥建议：保持今天的热量目标不变，优先保证蛋白质摄入和饮水量，稍后可以再问我一次。',
          timestamp: new Date().toISOString(),
        },
      },
      { status },
    );
  }
}
