import { NextRequest, NextResponse } from 'next/server';
import { retrieveKnowledge } from '@/lib/rag/retrieval';
import { rerankChunks } from '@/lib/rag/rerank';
import type { RagSearchFilters } from '@/lib/rag/types';
import { requireAuth } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

interface SearchBody {
  query?: string;
  topK?: number;
  filters?: RagSearchFilters;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = await request.json() as SearchBody;
  const query = body.query?.trim();
  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

  try {
    const retrieved = await retrieveKnowledge({ query, topK: body.topK || 8, filters: body.filters });
    const reranked = await rerankChunks(query, retrieved.chunks);
    return NextResponse.json({
      intent: retrieved.intent,
      usedEmbedding: retrieved.usedEmbedding,
      chunks: reranked.slice(0, body.topK || 8),
      source: 'rag',
    });
  } catch (error) {
    return NextResponse.json({ chunks: [], source: 'local', warning: getRouteErrorMessage(error, '知识库检索暂时不可用') });
  }
}

