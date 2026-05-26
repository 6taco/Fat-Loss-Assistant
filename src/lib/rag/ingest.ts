import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { chunkKnowledgeSource } from '@/lib/rag/chunking';
import { embedTexts, getGLMEmbeddingModel } from '@/lib/rag/glm-embedding';
import type { RagSourceInput } from '@/lib/rag/types';

export async function ingestKnowledgeSource(input: RagSourceInput) {
  const prisma = getPrisma();
  const checksum = checksumFor(input);
  const existing = await prisma.knowledgeSource.findFirst({ where: { checksum } });
  if (existing) {
    return { sourceId: existing.id, chunks: 0, skipped: true };
  }

  const chunks = chunkKnowledgeSource(input);
  const embeddings = await embedChunks(chunks.map(chunk => `${chunk.title}\n${chunk.text}`));
  const source = await prisma.knowledgeSource.create({
    data: {
      title: input.title,
      authority: input.authority,
      sourceType: input.sourceType,
      url: input.url,
      year: input.year,
      language: input.language || 'zh',
      license: input.license,
      checksum,
      status: 'active',
      chunks: {
        create: chunks.map((chunk, index) => ({
          chunkIndex: chunk.chunkIndex,
          title: chunk.title,
          text: chunk.text,
          summary: chunk.summary,
          topic: chunk.topic as unknown as Prisma.InputJsonValue,
          metadata: chunk.metadata as unknown as Prisma.InputJsonValue,
          tokenCount: chunk.tokenCount,
          embedding: embeddings[index] as unknown as Prisma.InputJsonValue,
          embeddingModel: embeddings[index]?.length ? getGLMEmbeddingModel() : undefined,
        })),
      },
    },
  });

  return { sourceId: source.id, chunks: chunks.length, skipped: false };
}

export async function reindexKnowledgeSource(sourceId: string) {
  const prisma = getPrisma();
  const chunks = await prisma.knowledgeChunk.findMany({ where: { sourceId, status: 'active' }, orderBy: { chunkIndex: 'asc' } });
  const embeddings = await embedChunks(chunks.map(chunk => `${chunk.title}\n${chunk.text}`));
  await prisma.$transaction(chunks.map((chunk, index) => prisma.knowledgeChunk.update({
    where: { id: chunk.id },
    data: {
      embedding: embeddings[index] as unknown as Prisma.InputJsonValue,
      embeddingModel: embeddings[index]?.length ? getGLMEmbeddingModel() : undefined,
    },
  })));
  return { sourceId, chunks: chunks.length };
}

async function embedChunks(texts: string[]) {
  try {
    return await embedTexts(texts);
  } catch {
    return texts.map(() => []);
  }
}

function checksumFor(input: RagSourceInput) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      title: input.title,
      authority: input.authority,
      sourceType: input.sourceType,
      year: input.year,
      content: input.content,
    }))
    .digest('hex');
}
