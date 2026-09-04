// Local-first food matching: a curated per-serving library plus the user's
// own logged items let common meals be estimated without an AI round trip.
// Zero imports so the Node test runner can load it directly.

export interface LibraryFood {
  name: string;
  aliases: string[];
  amountText: string;
  weightGram: number;
  calories: number;
  carb: number;
  protein: number;
  fat: number;
}

export interface HistoryFood {
  name: string;
  count: number;
  weightGram: number;
  calories: number;
  carb: number;
  protein: number;
  fat: number;
}

export interface LocalEstimateItem {
  name: string;
  amountText: string;
  weightGram: number;
  calories: number;
  carb: number;
  protein: number;
  fat: number;
  confidence: number;
}

export interface LocalEstimate {
  description: string;
  items: LocalEstimateItem[];
  carb: number;
  protein: number;
  fat: number;
  calories: number;
  confidence: number;
  warnings: string[];
}

// Per common serving, rounded; good enough to pre-fill and let the user trim.
export const FOOD_LIBRARY: LibraryFood[] = [
  // 主食
  { name: '米饭', aliases: ['白米饭', '大米饭'], amountText: '1碗(熟)', weightGram: 200, calories: 232, carb: 50, protein: 5, fat: 1 },
  { name: '糙米饭', aliases: [], amountText: '1碗(熟)', weightGram: 180, calories: 216, carb: 45, protein: 5, fat: 2 },
  { name: '燕麦', aliases: ['燕麦片', '麦片'], amountText: '干40g', weightGram: 40, calories: 150, carb: 27, protein: 5, fat: 3 },
  { name: '全麦面包', aliases: ['全麦吐司'], amountText: '1片', weightGram: 35, calories: 90, carb: 15, protein: 4, fat: 1.5 },
  { name: '面条', aliases: ['拉面', '挂面'], amountText: '1碗(熟)', weightGram: 250, calories: 280, carb: 55, protein: 9, fat: 2 },
  { name: '红薯', aliases: ['地瓜', '山芋'], amountText: '中等1个', weightGram: 150, calories: 130, carb: 30, protein: 2, fat: 0.3 },
  { name: '土豆', aliases: ['马铃薯'], amountText: '中等1个', weightGram: 150, calories: 115, carb: 26, protein: 3, fat: 0.2 },
  { name: '玉米', aliases: ['甜玉米'], amountText: '1根', weightGram: 200, calories: 110, carb: 24, protein: 4, fat: 1.5 },
  { name: '馒头', aliases: [], amountText: '1个', weightGram: 100, calories: 223, carb: 47, protein: 7, fat: 1 },
  // 蛋白
  { name: '鸡胸肉', aliases: ['鸡胸'], amountText: '150g', weightGram: 150, calories: 180, carb: 0, protein: 34, fat: 4 },
  { name: '鸡腿', aliases: ['琵琶腿'], amountText: '1个(去皮)', weightGram: 120, calories: 180, carb: 0, protein: 26, fat: 8 },
  { name: '鸡蛋', aliases: ['水煮蛋', '煮鸡蛋', '荷包蛋'], amountText: '1个', weightGram: 50, calories: 72, carb: 1, protein: 6, fat: 5 },
  { name: '牛肉', aliases: ['瘦牛肉', '牛里脊'], amountText: '100g', weightGram: 100, calories: 125, carb: 2, protein: 20, fat: 5 },
  { name: '猪里脊', aliases: ['瘦肉', '猪瘦肉'], amountText: '100g', weightGram: 100, calories: 143, carb: 1, protein: 21, fat: 6 },
  { name: '三文鱼', aliases: ['鲑鱼'], amountText: '100g', weightGram: 100, calories: 180, carb: 0, protein: 20, fat: 11 },
  { name: '鳕鱼', aliases: ['龙利鱼', '巴沙鱼'], amountText: '120g', weightGram: 120, calories: 110, carb: 0, protein: 22, fat: 2 },
  { name: '虾', aliases: ['基围虾', '虾仁', '白灼虾'], amountText: '100g', weightGram: 100, calories: 95, carb: 1, protein: 18, fat: 1 },
  { name: '豆腐', aliases: ['北豆腐', '卤水豆腐'], amountText: '100g', weightGram: 100, calories: 84, carb: 3, protein: 8, fat: 6 },
  { name: '无糖酸奶', aliases: ['酸奶', '希腊酸奶'], amountText: '1杯(150g)', weightGram: 150, calories: 95, carb: 8, protein: 12, fat: 3 },
  { name: '牛奶', aliases: ['纯牛奶', '脱脂牛奶'], amountText: '1盒(250ml)', weightGram: 250, calories: 160, carb: 12, protein: 8, fat: 9 },
  { name: '豆浆', aliases: ['无糖豆浆'], amountText: '1杯(250ml)', weightGram: 250, calories: 80, carb: 6, protein: 7, fat: 4 },
  // 蔬菜
  { name: '西兰花', aliases: ['绿花菜'], amountText: '150g', weightGram: 150, calories: 50, carb: 8, protein: 6, fat: 1 },
  { name: '绿叶菜', aliases: ['青菜', '生菜', '菠菜', '油麦菜', '小白菜'], amountText: '200g', weightGram: 200, calories: 35, carb: 5, protein: 3, fat: 0.5 },
  { name: '黄瓜', aliases: ['青瓜'], amountText: '1根', weightGram: 200, calories: 30, carb: 6, protein: 1.5, fat: 0.3 },
  { name: '番茄', aliases: ['西红柿'], amountText: '1个', weightGram: 150, calories: 25, carb: 5, protein: 1, fat: 0.2 },
  { name: '胡萝卜', aliases: [], amountText: '1根', weightGram: 150, calories: 60, carb: 13, protein: 1.5, fat: 0.5 },
  { name: '蘑菇', aliases: ['香菇', '金针菇', '杏鲍菇'], amountText: '150g', weightGram: 150, calories: 45, carb: 7, protein: 4, fat: 0.6 },
  // 水果
  { name: '香蕉', aliases: [], amountText: '1根', weightGram: 120, calories: 105, carb: 27, protein: 1, fat: 0.4 },
  { name: '苹果', aliases: ['红富士'], amountText: '1个', weightGram: 200, calories: 104, carb: 27, protein: 0.5, fat: 0.3 },
  { name: '橙子', aliases: ['脐橙', '橘子', '桔子'], amountText: '1个', weightGram: 180, calories: 85, carb: 21, protein: 1, fat: 0.2 },
  { name: '蓝莓', aliases: ['草莓', '树莓'], amountText: '100g', weightGram: 100, calories: 55, carb: 12, protein: 0.8, fat: 0.3 },
  { name: '西瓜', aliases: [], amountText: '300g', weightGram: 300, calories: 78, carb: 19, protein: 1.5, fat: 0.4 },
  // 脂肪与坚果
  { name: '牛油果', aliases: ['鳄梨'], amountText: '半个', weightGram: 100, calories: 160, carb: 9, protein: 2, fat: 15 },
  { name: '坚果', aliases: ['混合坚果', '杏仁', '核桃', '腰果'], amountText: '1小把(30g)', weightGram: 30, calories: 180, carb: 6, protein: 6, fat: 16 },
  { name: '橄榄油', aliases: ['食用油', '油'], amountText: '10ml', weightGram: 10, calories: 88, carb: 0, protein: 0, fat: 10 },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

function tokenize(description: string): string[] {
  return description
    .split(/[、，,。;；/|+]+|\s+|和|跟|与|加|再来一个|再来一份/g)
    .map(token => token.trim())
    .filter(token => token.length > 0);
}

function textMatches(token: string, name: string): boolean {
  if (name.length < 2) return false;
  return token.includes(name) || name.includes(token);
}

function findLibraryFood(token: string, library: LibraryFood[]): LibraryFood | null {
  const normalized = normalize(token);
  for (const food of library) {
    if (textMatches(normalized, normalize(food.name))) return food;
    for (const alias of food.aliases) {
      if (textMatches(normalized, normalize(alias))) return food;
    }
  }
  return null;
}

// "150g" / "150克" / "半碗" style explicit amounts scale the matched macros.
function extractGrams(token: string, fallbackGrams: number): { grams: number; explicit: boolean } {
  const match = token.match(/(\d+(?:\.\d+)?)\s*(?:g|克|ml|毫升)/i);
  if (match) {
    const grams = Number.parseFloat(match[1]);
    if (Number.isFinite(grams) && grams >= 5 && grams <= 1500) return { grams, explicit: true };
  }
  return { grams: fallbackGrams, explicit: false };
}

function scale(base: { calories: number; carb: number; protein: number; fat: number }, ratio: number) {
  return {
    calories: Math.round(base.calories * ratio),
    carb: Math.round(base.carb * ratio * 10) / 10,
    protein: Math.round(base.protein * ratio * 10) / 10,
    fat: Math.round(base.fat * ratio * 10) / 10,
  };
}

// Build the user's personal food table from logged meal items (name → average
// macros across occurrences, most frequent first).
export function buildHistoryFoods(meals: Array<{ items?: Array<{ name: string; weightGram?: number; calories?: number; carb: number; protein: number; fat: number }> }>): HistoryFood[] {
  const byName = new Map<string, { total: HistoryFood; count: number }>();
  for (const meal of meals) {
    if (!Array.isArray(meal.items)) continue;
    for (const item of meal.items) {
      if (!item || typeof item.name !== 'string' || item.name.trim().length < 2) continue;
      const name = item.name.trim();
      const current = byName.get(name);
      if (current) {
        current.count += 1;
        current.total.weightGram += item.weightGram || 0;
        current.total.calories += item.calories || 0;
        current.total.carb += item.carb || 0;
        current.total.protein += item.protein || 0;
        current.total.fat += item.fat || 0;
      } else {
        byName.set(name, {
          count: 1,
          total: {
            name,
            count: 1,
            weightGram: item.weightGram || 0,
            calories: item.calories || 0,
            carb: item.carb || 0,
            protein: item.protein || 0,
            fat: item.fat || 0,
          },
        });
      }
    }
  }
  return [...byName.values()]
    .map(({ total, count }) => ({
      name: total.name,
      count,
      weightGram: Math.round(total.weightGram / count),
      calories: Math.round(total.calories / count),
      carb: Math.round((total.carb / count) * 10) / 10,
      protein: Math.round((total.protein / count) * 10) / 10,
      fat: Math.round((total.fat / count) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

function findHistoryFood(token: string, history: HistoryFood[]): HistoryFood | null {
  const normalized = normalize(token);
  for (const food of history) {
    if (textMatches(normalized, normalize(food.name))) return food;
  }
  return null;
}

// Returns a complete local estimate when every token of the description is
// recognized; anything unrecognized falls through so the AI can handle it.
export function matchLocalEstimate(description: string, history: HistoryFood[], library: LibraryFood[] = FOOD_LIBRARY): LocalEstimate | null {
  const tokens = tokenize(description);
  if (!tokens.length) return null;

  const items: LocalEstimateItem[] = [];
  const warnings: string[] = [];
  let usedHistory = false;

  for (const token of tokens) {
    const historyFood = findHistoryFood(token, history);
    const base = historyFood ?? findLibraryFood(token, library);
    if (!base) return null;
    usedHistory = usedHistory || Boolean(historyFood);

    const { grams, explicit } = extractGrams(token, base.weightGram || 100);
    const ratio = base.weightGram > 0 ? grams / base.weightGram : 1;
    const scaled = scale({ calories: base.calories, carb: base.carb, protein: base.protein, fat: base.fat }, ratio);
    const fallbackAmountText = 'amountText' in base && base.amountText ? base.amountText : `${grams}g`;
    items.push({
      name: base.name,
      amountText: explicit ? `${grams}g` : fallbackAmountText,
      weightGram: grams,
      confidence: historyFood ? 0.75 : 0.6,
      ...scaled,
    });
  }

  const totals = items.reduce((sum, item) => ({
    carb: sum.carb + item.carb,
    protein: sum.protein + item.protein,
    fat: sum.fat + item.fat,
    calories: sum.calories + item.calories,
  }), { carb: 0, protein: 0, fat: 0, calories: 0 });

  warnings.push('本地食物库估算，按常见一人份计，请核对份量后保存。');
  if (usedHistory) warnings.push('部分食物参考了你自己的历史记录。');

  return {
    description: description.trim(),
    items,
    carb: Math.round(totals.carb * 10) / 10,
    protein: Math.round(totals.protein * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    calories: Math.round(totals.calories),
    confidence: usedHistory ? 0.7 : 0.6,
    warnings,
  };
}
