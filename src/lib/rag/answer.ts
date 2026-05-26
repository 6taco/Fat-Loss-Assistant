import { Prisma } from '@prisma/client';
import { askDeepSeek } from '@/lib/deepseek';
import { getPrisma } from '@/lib/prisma';
import { inferIntent, shouldUseRag } from '@/lib/rag/intent';
import { retrieveKnowledge } from '@/lib/rag/retrieval';
import { rerankChunks } from '@/lib/rag/rerank';
import type { RagAnswerResult, RagCitation, RagConfidence, RagRetrievedChunk } from '@/lib/rag/types';

interface RagAnswerOptions {
  userId?: string;
  question: string;
  context?: unknown;
}

const answerCache = new Map<string, { result: RagAnswerResult; expiresAt: number }>();

export async function answerWithRag(options: RagAnswerOptions): Promise<RagAnswerResult> {
  const startedAt = Date.now();
  const intent = inferIntent(options.question);
  const cacheKey = buildAnswerCacheKey(options.question, intent);
  const cached = answerCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  if (!shouldUseRag(options.question)) {
    return buildInsufficientAnswer('当前问题不需要知识库检索。');
  }

  const retrieved = await retrieveKnowledge({ query: options.question, intent, topK: 12 });
  if (!retrieved.chunks.length) {
    const result = buildInsufficientAnswer('当前知识库证据不足，还没有检索到可引用的权威资料。');
    await logQuery(options, intent, [], result, Date.now() - startedAt);
    return result;
  }

  const reranked = await rerankChunks(options.question, retrieved.chunks);
  const evidence = reranked.slice(0, 4);
  const citations = buildCitations(evidence);
  const confidence = getConfidence(evidence);

  if (confidence === 'low') {
    const result = buildInsufficientAnswer('当前知识库证据不足，建议先补充更权威的资料后再生成专业回答。', citations);
    await logQuery(options, intent, evidence, result, Date.now() - startedAt);
    return result;
  }

  const answer = await generateEvidenceAnswer(options.question, options.context, evidence);
  const result: RagAnswerResult = {
    answer,
    citations,
    confidence,
    source: 'rag',
  };
  answerCache.set(cacheKey, { result, expiresAt: Date.now() + 1000 * 60 * 10 });
  await logQuery(options, intent, evidence, result, Date.now() - startedAt);
  return result;
}

function buildAnswerCacheKey(question: string, intent: string) {
  return `${intent}:${question.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240)}`;
}

async function generateEvidenceAnswer(question: string, context: unknown, chunks: RagRetrievedChunk[]) {
  const evidence = chunks.map((chunk, index) => [
    `[${index + 1}] 来源：${chunk.source.title}；机构：${chunk.source.authority}${chunk.source.year ? `；年份：${chunk.source.year}` : ''}`,
    `章节：${chunk.title}`,
    `内容：${chunk.text.slice(0, 420)}`,
  ].join('\n')).join('\n\n');

  return askDeepSeek([
    {
      role: 'system',
      content: [
        '你是 AI Fat Loss Coach 的知识库问答代理。',
        '你必须优先依据“知识库证据”回答。',
        '如果证据不足，明确说“当前知识库证据不足”，不要编造。',
        '不要做医疗诊断，不承诺治疗效果。',
        '回答使用中文，语气温和、具体、适合移动端阅读。',
        '回答要求：先直接回答问题；给 1-3 个可执行建议；引用证据编号，例如 [1][2]；不要输出 Markdown 表格。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `用户问题：${question}`,
        `用户上下文：${context ? JSON.stringify(context, null, 2) : '无'}`,
        `知识库证据：\n${evidence}`,
      ].join('\n\n'),
    },
  ]);
}

function buildCitations(chunks: RagRetrievedChunk[]): RagCitation[] {
  return chunks.map((chunk, index) => ({
    chunkId: chunk.chunkId,
    sourceId: chunk.sourceId,
    label: `[${index + 1}]`,
    title: chunk.source.title,
    authority: chunk.source.authority,
    year: chunk.source.year,
  }));
}

function getConfidence(chunks: RagRetrievedChunk[]): RagConfidence {
  const topScore = chunks[0]?.score || 0;
  if (topScore >= 0.55 || chunks.length >= 4) return 'high';
  if (topScore >= 0.25 || chunks.length >= 2) return 'medium';
  return 'low';
}

function buildInsufficientAnswer(reason: string, citations: RagCitation[] = []): RagAnswerResult {
  return {
    answer: `${reason}\n\n我可以先给一个保守方向：优先记录饮食和体重趋势，不要基于单日波动做激进调整。`,
    citations,
    confidence: 'low',
    source: 'rag',
  };
}

async function logQuery(options: RagAnswerOptions, intent: string, chunks: RagRetrievedChunk[], result: RagAnswerResult, latencyMs: number) {
  try {
    const prisma = getPrisma();
    await prisma.ragQueryLog.create({
      data: {
        userId: options.userId,
        question: options.question,
        intent,
        retrieved: chunks.map(chunk => ({ chunkId: chunk.chunkId, score: chunk.score, sourceId: chunk.sourceId })) as unknown as Prisma.InputJsonValue,
        citations: result.citations as unknown as Prisma.InputJsonValue,
        confidence: result.confidence,
        latencyMs,
      },
    });
  } catch {
    // Query logging should never block the user-facing answer.
  }
}
