import type { RagChunkInput, RagSourceInput } from '@/lib/rag/types';

const TARGET_CHUNK_SIZE = 760;
const MAX_CHUNK_SIZE = 1200;
const MIN_CHUNK_SIZE = 120;
const OVERLAP_SIZE = 100;

export function chunkKnowledgeSource(input: RagSourceInput): RagChunkInput[] {
  const sections = splitIntoSections(normalizeContent(input.content), input.title);
  const chunks: RagChunkInput[] = [];
  const topic = normalizeTopic(input.topic);

  for (const section of sections) {
    for (const text of splitSectionText(section.text)) {
      const chunkText = text.trim();
      if (chunkText.length < MIN_CHUNK_SIZE && chunks.length > 0) {
        const previous = chunks[chunks.length - 1];
        previous.text = `${previous.text}\n\n${chunkText}`.trim();
        previous.summary = summarizeChunk(previous.text);
        previous.tokenCount = estimateTokenCount(previous.text);
        continue;
      }

      chunks.push({
        chunkIndex: chunks.length,
        title: section.title,
        text: chunkText,
        summary: summarizeChunk(chunkText),
        topic,
        metadata: {
          ...(input.metadata || {}),
          chapter: section.title,
          sourceTitle: input.title,
          authority: input.authority,
          year: input.year,
        },
        tokenCount: estimateTokenCount(chunkText),
      });
    }
  }

  return chunks.filter(chunk => chunk.text.length >= MIN_CHUNK_SIZE || chunks.length === 1);
}

function normalizeContent(content: string) {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoSections(content: string, fallbackTitle: string) {
  const lines = content.split('\n');
  const sections: { title: string; text: string }[] = [];
  let currentTitle = fallbackTitle;
  let buffer: string[] = [];

  for (const line of lines) {
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      if (buffer.join('\n').trim()) {
        sections.push({ title: currentTitle, text: buffer.join('\n').trim() });
      }
      currentTitle = heading[2].trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }

  if (buffer.join('\n').trim()) {
    sections.push({ title: currentTitle, text: buffer.join('\n').trim() });
  }

  return sections.length ? sections : [{ title: fallbackTitle, text: content }];
}

function splitSectionText(text: string) {
  const paragraphs = text.split(/\n\s*\n/).map(item => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if ((current.length + paragraph.length + 2) <= TARGET_CHUNK_SIZE) {
      current = `${current}\n\n${paragraph}`;
    } else {
      chunks.push(...splitLongText(current));
      const overlap = current.slice(Math.max(0, current.length - OVERLAP_SIZE));
      current = overlap.length >= 30 ? `${overlap}\n\n${paragraph}` : paragraph;
    }
  }

  if (current) chunks.push(...splitLongText(current));
  return chunks;
}

function splitLongText(text: string) {
  if (text.length <= MAX_CHUNK_SIZE) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + TARGET_CHUNK_SIZE);
    chunks.push(text.slice(start, end));
    start = Math.max(end - OVERLAP_SIZE, end);
  }
  return chunks;
}

function summarizeChunk(text: string) {
  return text.replace(/\s+/g, ' ').slice(0, 220);
}

function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 1.7);
}

function normalizeTopic(topic?: string[]) {
  const values = Array.isArray(topic) ? topic.map(item => item.trim()).filter(Boolean) : [];
  return values.length ? values : ['fat_loss'];
}
