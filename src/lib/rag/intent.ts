import type { RagIntent, RagSearchFilters } from '@/lib/rag/types';

export function inferIntent(question: string): RagIntent {
  const text = question.toLowerCase();

  if (/(\u81ea\u6740|\u81ea\u6b8b|\u6d3b\u4e0d\u4e0b\u53bb|\u4f24\u5bb3\u81ea\u5df1|\u4f24\u5bb3\u522b\u4eba|\u6781\u7aef\u7edd\u671b)/.test(question)) return 'safety';
  if (/(\u5e73\u53f0|\u505c\u6ede|\u4e0d\u6389\u79e4|\u53cd\u5f39|\u4f53\u91cd\u4e0d\u52a8)/.test(question)) return 'plateau';
  if (/(\u8bad\u7ec3|\u529b\u91cf|\u6709\u6c27|\u808c\u8089|\u52a8\u4f5c|\u5367\u63a8|\u6df1\u8e72|\u8dd1\u6b65|\u8fd0\u52a8)/.test(question)) return 'training';
  if (/(\u5403\u4ec0\u4e48|\u98df\u8c31|\u9910\u5355|\u65e9\u9910|\u5348\u9910|\u665a\u9910|\u52a0\u9910|\u91c7\u8d2d)/.test(question)) return 'meal_plan';
  if (/(\u70ed\u91cf|\u86cb\u767d|\u8102\u80aa|\u78b3\u6c34|\u81b3\u98df|\u8425\u517b|\u7ef4\u751f\u7d20|\u996e\u98df|\u4f4e\u78b3|\u9ad8\u78b3)/.test(question)) return 'nutrition';
  if (/(calorie|protein|carb|fat|diet|training|plateau|nutrition)/.test(text)) return 'nutrition';

  return 'general';
}

export function filtersForIntent(intent: RagIntent): RagSearchFilters {
  if (intent === 'nutrition') return { topic: ['nutrition', 'fat_loss'] };
  if (intent === 'training') return { topic: ['training', 'exercise'] };
  if (intent === 'plateau') return { topic: ['plateau', 'fat_loss', 'adherence'] };
  if (intent === 'meal_plan') return { topic: ['nutrition', 'meal_plan', 'fat_loss'] };
  if (intent === 'safety') return { topic: ['safety', 'health'] };
  return {};
}

export function shouldUseRag(question: string) {
  return inferIntent(question) !== 'general' || question.length >= 8;
}
