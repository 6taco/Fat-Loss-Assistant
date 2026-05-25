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
          content: '我现在暂时连不上 AI 服务，但你不用一个人硬扛。先把今天的要求放低一点：喝点水，吃一份稳定的蛋白质，能做到这一步就已经是在往前走了。稍后再来找我，我们一起慢慢处理。',
          timestamp: new Date().toISOString(),
        },
      },
      { status },
    );
  }
}
