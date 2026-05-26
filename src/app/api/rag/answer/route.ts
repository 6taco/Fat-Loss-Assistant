import { NextRequest, NextResponse } from 'next/server';
import { answerWithRag } from '@/lib/rag/answer';

interface AnswerBody {
  userId?: string;
  question?: string;
  context?: unknown;
}

export async function POST(request: NextRequest) {
  const body = await request.json() as AnswerBody;
  const question = body.question?.trim();
  if (!question) return NextResponse.json({ error: 'question is required' }, { status: 400 });

  try {
    const result = await answerWithRag({ userId: body.userId, question, context: body.context });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      answer: `当前知识库暂时不可用：${getErrorMessage(error)}\n\n我可以先给一个保守方向：不要基于单日体重波动做激进调整，优先看 7-14 天趋势。`,
      citations: [],
      confidence: 'low',
      source: 'rag',
    });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'RAG 回答生成失败';
}
