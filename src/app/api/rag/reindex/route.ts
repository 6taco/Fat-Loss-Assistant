import { NextRequest, NextResponse } from 'next/server';
import { reindexKnowledgeSource } from '@/lib/rag/ingest';
import { requireAdmin } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

interface ReindexBody {
  sourceId?: string;
}

export async function POST(request: NextRequest) {
  const authResponse = requireAdmin(request);
  if (authResponse) return authResponse;
  const body = await request.json() as ReindexBody;
  if (!body.sourceId) return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });

  try {
    const result = await reindexKnowledgeSource(body.sourceId);
    return NextResponse.json({ ...result, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, '知识库重建索引失败'), source: 'local' }, { status: 503 });
  }
}

