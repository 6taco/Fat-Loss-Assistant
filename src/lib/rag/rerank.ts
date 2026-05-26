import { askDeepSeek } from '@/lib/deepseek';
import type { RagRetrievedChunk } from '@/lib/rag/types';

interface RerankResponse {
  ranked?: Array<{
    chunkId?: string;
    score?: number;
    reason?: string;
  }>;
}

export async function rerankChunks(query: string, chunks: RagRetrievedChunk[]): Promise<RagRetrievedChunk[]> {
  if (chunks.length <= 1) return chunks;
  const useLLMRerank = process.env.RAG_USE_LLM_RERANK === 'true';
  const candidates = chunks.slice(0, 12);

  if (!useLLMRerank) return fallbackRank(candidates);

  try {
    const response = await askDeepSeek([
      {
        role: 'system',
        content: [
          '你是减脂知识库检索重排器。',
          '请根据用户问题，对候选资料进行相关性排序。',
          '只返回 JSON，不要解释。',
          '评分标准：是否直接回答问题、是否来自权威来源、是否适合减脂教练场景、是否避免医疗诊断。',
          '输出格式：{"ranked":[{"chunkId":"...","score":0.0,"reason":"..."}]}',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          query,
          chunks: candidates.map(chunk => ({
            chunkId: chunk.chunkId,
            title: chunk.title,
            authority: chunk.source.authority,
            year: chunk.source.year,
            text: (chunk.summary || chunk.text).slice(0, 320),
          })),
        }, null, 2),
      },
    ]);
    return applyRerank(candidates, parseJson(response));
  } catch {
    return fallbackRank(chunks);
  }
}

function applyRerank(chunks: RagRetrievedChunk[], response: RerankResponse) {
  const rankMap = new Map<string, number>();
  for (const item of response.ranked || []) {
    if (!item.chunkId || typeof item.score !== 'number') continue;
    rankMap.set(item.chunkId, Math.max(0, Math.min(1, item.score)));
  }

  if (!rankMap.size) return fallbackRank(chunks);
  return [...chunks].sort((a, b) => (rankMap.get(b.chunkId) ?? b.score) - (rankMap.get(a.chunkId) ?? a.score));
}

function fallbackRank(chunks: RagRetrievedChunk[]) {
  return [...chunks].sort((a, b) => fallbackScore(b) - fallbackScore(a));
}

function fallbackScore(chunk: RagRetrievedChunk) {
  const authorityWeight = /中国营养学会|国家卫健委|ACSM|NASM/i.test(chunk.source.authority) ? 1 : 0.5;
  const recencyWeight = chunk.source.year && chunk.source.year >= 2018 ? 1 : 0.5;
  return chunk.vectorScore * 0.7 + authorityWeight * 0.2 + recencyWeight * 0.1 + chunk.keywordScore * 0.15;
}

function parseJson(content: string): RerankResponse {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return {};
  return JSON.parse(content.slice(start, end + 1)) as RerankResponse;
}
