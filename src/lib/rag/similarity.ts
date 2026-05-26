export function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index++) {
    dot += a[index] * b[index];
    normA += a[index] ** 2;
    normB += b[index] ** 2;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function keywordScore(query: string, text: string) {
  const queryTerms = tokenize(query);
  if (!queryTerms.length) return 0;
  const target = text.toLowerCase();
  const hits = queryTerms.filter(term => target.includes(term)).length;
  return hits / queryTerms.length;
}

export function tokenize(text: string) {
  const ascii = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  const cjk = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const cjkTerms = cjk.flatMap(segment => {
    const terms: string[] = [];
    for (let index = 0; index < segment.length - 1; index++) {
      terms.push(segment.slice(index, index + 2));
    }
    return terms;
  });
  return [...new Set([...ascii, ...cjkTerms])].slice(0, 80);
}

export function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}
