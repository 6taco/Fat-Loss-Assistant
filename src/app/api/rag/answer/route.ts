import { NextRequest, NextResponse } from 'next/server';
import { answerWithRag } from '@/lib/rag/answer';
import { requireAuth } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

interface AnswerBody {
  userId?: string;
  question?: string;
  context?: unknown;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = await request.json() as AnswerBody;
  const question = body.question?.trim();
  if (!question) return NextResponse.json({ error: 'question is required' }, { status: 400 });

  try {
    const result = await answerWithRag({ userId: auth.context.userId || undefined, question, context: body.context });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      answer: `当前知识库暂时不可用：${getRouteErrorMessage(error, 'RAG 回答生成失败')}\n\n我可以先给一个保守方向：不要基于单日体重波动做激进调整，优先看 7-14 天趋势。`,
      citations: [],
      confidence: 'low',
      source: 'rag',
    });
  }
}

