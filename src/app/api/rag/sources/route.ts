import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

export async function GET(request: NextRequest) {
  const authResponse = requireAdmin(request);
  if (authResponse) return authResponse;
  const limit = Number(request.nextUrl.searchParams.get('limit') || 50);

  try {
    const prisma = getPrisma();
    const sources = await prisma.knowledgeSource.findMany({
      orderBy: { updatedAt: 'desc' },
      take: Math.max(1, Math.min(100, limit)),
      include: { _count: { select: { chunks: true } } },
    });
    return NextResponse.json({
      sources: sources.map(source => ({
        id: source.id,
        title: source.title,
        authority: source.authority,
        sourceType: source.sourceType,
        year: source.year,
        language: source.language,
        status: source.status,
        chunks: source._count.chunks,
        createdAt: source.createdAt.toISOString(),
        updatedAt: source.updatedAt.toISOString(),
      })),
      source: 'db',
    });
  } catch (error) {
    return NextResponse.json({ sources: [], source: 'local', warning: getRouteErrorMessage(error, '知识库来源读取失败') });
  }
}

