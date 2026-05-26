import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { embedText } from '@/lib/rag/glm-embedding';
import { filtersForIntent, inferIntent } from '@/lib/rag/intent';
import { cosineSimilarity, keywordScore, toNumberArray } from '@/lib/rag/similarity';
import type { RagIntent, RagRetrievedChunk, RagSearchFilters } from '@/lib/rag/types';

interface SearchOptions {
  query: string;
  topK?: number;
  filters?: RagSearchFilters;
  intent?: RagIntent;
}

const chunkCache = new Map<string, { expiresAt: number; records: KnowledgeRecord[] }>();

export async function retrieveKnowledge(options: SearchOptions): Promise<{ intent: RagIntent; chunks: RagRetrievedChunk[]; usedEmbedding: boolean }> {
  const intent = options.intent || inferIntent(options.query);
  const filters = mergeFilters(filtersForIntent(intent), options.filters);
  const records = await getCachedChunks(filters);

  const filtered = records.filter(record => matchesTopic(record.topic, filters.topic));
  let queryEmbedding: number[] = [];
  let usedEmbedding = false;
  try {
    queryEmbedding = await embedText(options.query);
    usedEmbedding = queryEmbedding.length > 0;
  } catch {
    usedEmbedding = false;
  }

  const scored = filtered.map(record => {
    const embedding = toNumberArray(record.embedding);
    const vectorScore = usedEmbedding && embedding.length ? cosineSimilarity(queryEmbedding, embedding) : 0;
    const kwScore = keywordScore(options.query, `${record.title}\n${record.summary || ''}\n${record.text}`);
    const score = usedEmbedding ? vectorScore * 0.78 + kwScore * 0.22 : kwScore;
    return toRetrievedChunk(record, score, vectorScore, kwScore);
  });

  return {
    intent,
    usedEmbedding,
    chunks: scored
      .filter(chunk => chunk.score > 0 || chunk.keywordScore > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(Math.max(options.topK || 12, 12), 24)),
  };
}

async function getCachedChunks(filters: RagSearchFilters) {
  const key = JSON.stringify({
    sourceType: filters.sourceType?.slice().sort() || [],
  });
  const cached = chunkCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.records;

  const prisma = getPrisma();
  const records = await prisma.knowledgeChunk.findMany({
    where: {
      status: 'active',
      source: {
        status: 'active',
        ...(filters.sourceType?.length ? { sourceType: { in: filters.sourceType } } : {}),
      },
    },
    include: { source: true },
    orderBy: { updatedAt: 'desc' },
    take: 1200,
  });
  chunkCache.set(key, { records, expiresAt: Date.now() + 1000 * 60 * 5 });
  return records;
}

function mergeFilters(base: RagSearchFilters, override?: RagSearchFilters): RagSearchFilters {
  return {
    topic: override?.topic?.length ? override.topic : base.topic,
    sourceType: override?.sourceType?.length ? override.sourceType : base.sourceType,
  };
}

function matchesTopic(value: unknown, topics?: string[]) {
  if (!topics?.length) return true;
  if (!Array.isArray(value)) return true;
  const normalized = value.filter((item): item is string => typeof item === 'string').map(item => item.toLowerCase());
  return topics.some(topic => normalized.includes(topic.toLowerCase()));
}

function toRetrievedChunk(record: {
  id: string;
  sourceId: string;
  title: string;
  text: string;
  summary: string | null;
  topic: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  embedding: Prisma.JsonValue | null;
  source: {
    title: string;
    authority: string;
    sourceType: string;
    year: number | null;
    url: string | null;
  };
}, score: number, vectorScore: number, kwScore: number): RagRetrievedChunk {
  return {
    chunkId: record.id,
    sourceId: record.sourceId,
    title: record.title,
    text: record.text,
    summary: record.summary || undefined,
    topic: Array.isArray(record.topic) ? record.topic.filter((item): item is string => typeof item === 'string') : [],
    metadata: record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata) ? record.metadata as Record<string, unknown> : {},
    score,
    vectorScore,
    keywordScore: kwScore,
    source: {
      title: record.source.title,
      authority: record.source.authority,
      sourceType: record.source.sourceType,
      year: record.source.year || undefined,
      url: record.source.url || undefined,
    },
  };
}

type KnowledgeRecord = Parameters<typeof toRetrievedChunk>[0];
