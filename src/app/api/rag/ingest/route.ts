import { NextRequest, NextResponse } from 'next/server';
import { ingestKnowledgeSource } from '@/lib/rag/ingest';
import type { RagSourceInput } from '@/lib/rag/types';
import { requireAdmin } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

export async function POST(request: NextRequest) {
  const authResponse = requireAdmin(request);
  if (authResponse) return authResponse;
  const body = await request.json() as Partial<RagSourceInput>;
  if (!body.title || !body.authority || !body.sourceType || !body.content) {
    return NextResponse.json({ error: 'title, authority, sourceType and content are required' }, { status: 400 });
  }

  try {
    const result = await ingestKnowledgeSource({
      title: body.title,
      authority: body.authority,
      sourceType: body.sourceType,
      url: body.url,
      year: body.year,
      language: body.language || 'zh',
      license: body.license,
      topic: body.topic,
      content: body.content,
      metadata: body.metadata,
    });
    return NextResponse.json({ ...result, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, '知识库导入暂时失败'), source: 'local' }, { status: 503 });
  }
}

