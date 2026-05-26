import { NextRequest, NextResponse } from 'next/server';
import { reindexKnowledgeSource } from '@/lib/rag/ingest';

interface ReindexBody {
  sourceId?: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json() as ReindexBody;
  if (!body.sourceId) return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });

  try {
    const result = await reindexKnowledgeSource(body.sourceId);
    return NextResponse.json({ ...result, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), source: 'local' }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '知识库重建索引失败';
}
