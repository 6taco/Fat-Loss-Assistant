interface GLMEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
}

const GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
const GLM_EMBEDDING_MODEL = process.env.GLM_EMBEDDING_MODEL || 'embedding-3';
const EMBEDDING_TIMEOUT_MS = Number(process.env.GLM_EMBEDDING_TIMEOUT_MS || 1800);
const embeddingCache = new Map<string, { value: number[]; expiresAt: number }>();

export function getGLMEmbeddingModel() {
  return GLM_EMBEDDING_MODEL;
}

export async function embedText(text: string): Promise<number[]> {
  const normalized = normalizeText(text);
  const cached = embeddingCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [embedding] = await embedTexts([text]);
  if (embedding?.length) {
    embeddingCache.set(normalized, { value: embedding, expiresAt: Date.now() + 1000 * 60 * 15 });
  }
  return embedding || [];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error('Missing GLM_API_KEY');
  if (!texts.length) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  const response = await fetch(`${GLM_BASE_URL}/embeddings`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GLM_EMBEDDING_MODEL,
      input: texts,
    }),
  }).finally(() => clearTimeout(timeout));

  const data = await response.json() as GLMEmbeddingResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `GLM embedding request failed: ${response.status}`);
  }

  return (data.data || []).map(item => Array.isArray(item.embedding) ? item.embedding : []);
}

function normalizeText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 500);
}
