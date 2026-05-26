export type RagIntent = 'nutrition' | 'training' | 'plateau' | 'meal_plan' | 'safety' | 'general';
export type RagConfidence = 'high' | 'medium' | 'low';

export interface RagSourceInput {
  title: string;
  authority: string;
  sourceType: string;
  url?: string;
  year?: number;
  language?: string;
  license?: string;
  topic?: string[];
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RagChunkInput {
  chunkIndex: number;
  title: string;
  text: string;
  summary?: string;
  topic: string[];
  metadata: Record<string, unknown>;
  tokenCount: number;
}

export interface RagRetrievedChunk {
  chunkId: string;
  sourceId: string;
  title: string;
  text: string;
  summary?: string;
  topic: string[];
  metadata: Record<string, unknown>;
  score: number;
  vectorScore: number;
  keywordScore: number;
  source: {
    title: string;
    authority: string;
    sourceType: string;
    year?: number;
    url?: string;
  };
}

export interface RagCitation {
  chunkId: string;
  sourceId: string;
  label: string;
  title: string;
  authority: string;
  year?: number;
}

export interface RagAnswerResult {
  answer: string;
  citations: RagCitation[];
  confidence: RagConfidence;
  source: 'rag';
}

export interface RagSearchFilters {
  topic?: string[];
  sourceType?: string[];
}
