import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

loadEnv(path.join(projectRoot, '.env'));
loadEnv(path.join(projectRoot, '.env.local'));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL');
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(databaseUrl),
  errorFormat: 'minimal',
});

const sources = [
  {
    title: '居民体重管理核心知识（2024年版）',
    authority: '国家卫生健康委',
    sourceType: 'guideline',
    url: 'https://www.nhc.gov.cn/cms-search/downFiles/7d923e78dee14ac98e058bb542eb1c01.pdf',
    year: 2024,
    language: 'zh',
    topic: ['fat_loss', 'adherence', 'safety'],
    content: `
## 正确认知，重在预防
体重管理不是短期冲刺，而是长期习惯管理。应尽早关注体重变化，避免把单日波动直接理解成脂肪增减。

## 终生管理，持之以恒
体重控制需要持续记录和长期跟踪。对减脂用户来说，建立长期可坚持的饮食、活动和作息模式，比短期极端节食更重要。

## 主动监测，合理评估
应结合体重、腰围、饮食、活动和睡眠一起看趋势，而不是只盯着某一次称重结果。短期波动常见，趋势更有意义。

## 平衡膳食，总量控制
减脂的核心是控制总能量，同时保持食物多样和规律进餐。更适合优先选择高营养密度、低能量密度的食物。

## 动则有益，贵在坚持
应减少久坐，增加日常活动，并把运动变成稳定习惯。长期坚持比偶尔高强度更能支持体重管理。

## 良好睡眠，积极心态
睡眠不足、压力过大、情绪波动，都会影响食欲、恢复和执行力。体重管理应兼顾睡眠和情绪。

## 目标合理，科学减重
减重目标应现实、渐进、可维持。更理想的路径是减少脂肪，同时尽量保住肌肉和日常状态。

## 共同行动，全家健康
家庭饮食环境和生活方式会影响坚持程度。家人一起配合，更容易把减脂变成长期习惯。
    `.trim(),
    metadata: {
      chapter: '体重管理核心知识',
      sourceTitle: '居民体重管理核心知识（2024年版）',
      origin: 'official',
    },
  },
  {
    title: '成人肥胖食养指南（2024年版）问答',
    authority: '国家卫生健康委',
    sourceType: 'guideline',
    url: 'https://www.nhc.gov.cn/sps/c100088/202402/9ba512ba8e314a47a181db11d2fa188d/files/1743476135429_97340.pdf',
    year: 2024,
    language: 'zh',
    topic: ['nutrition', 'fat_loss', 'meal_plan', 'safety'],
    content: `
## 指南目的
该指南面向成人肥胖管理，重点是通过日常膳食结构调整、食物选择优化和可持续的饮食习惯，帮助控制体重并改善营养状况。

## 核心思路
减脂不等于极端节食。更推荐总量控制、结构优化、规律进餐和长期坚持。不同地区、季节、口味和生活方式都应纳入实际执行方案。

## 落地方式
膳食建议要强调可操作性，适合普通人长期执行。比起一次性大幅限制，更重要的是建立稳定的日常饮食节奏与合理食物组合。

## 教练使用方式
在 AI 减脂教练里，这类知识适合用于解释为什么要控制总能量、为什么不能长期极端低热量、以及如何做成更可持续的减脂餐单。
    `.trim(),
    metadata: {
      chapter: '问答摘要',
      sourceTitle: '成人肥胖食养指南（2024年版）问答',
      origin: 'official',
    },
  },
  {
    title: '中国居民膳食指南（2022）- 食物多样与健康体重',
    authority: '中国营养学会',
    sourceType: 'guideline',
    url: 'https://dg.cnsoc.org/article/04/K7tlcs-UQh67DBC5XY1Jqw.html',
    year: 2022,
    language: 'zh',
    topic: ['nutrition', 'fat_loss', 'meal_plan'],
    content: `
## 食物多样，合理搭配
平衡膳食应以谷类为主，同时包含蔬菜水果、畜禽鱼蛋奶和豆类。每天和每周都应尽量做到食物种类丰富，提升营养密度。

## 吃动平衡，健康体重
体重变化是判断能量平衡最直观的信号。建议保持日常身体活动，每周累计中等强度身体活动不少于150分钟，并减少久坐。

## 适量运动
对于体重管理，高强度有氧运动和抗阻运动都可以作为补充方案。长期看，持续活动习惯比短期冲量更重要。

## 控制总量
减脂时不是把某一类食物完全清零，而是控制总能量、控制份量，并把高能量加工食品和过量零食降下来。
    `.trim(),
    metadata: {
      chapter: '准则二',
      sourceTitle: '中国居民膳食指南（2022）',
      origin: 'official',
    },
  },
  {
    title: '中国居民膳食指南（2022）- 蔬果、奶类、全谷、大豆',
    authority: '中国营养学会',
    sourceType: 'guideline',
    url: 'https://dg.cnsoc.org/article/04/70JvPbFmTlyZbjoO67LeRg.html',
    year: 2022,
    language: 'zh',
    topic: ['nutrition', 'meal_plan'],
    content: `
## 提高膳食密度
减脂餐更适合优先增加蔬菜、水果、奶类、全谷物和大豆类食物，让餐盘更有体积感和营养密度。

## 用全谷和豆类替代一部分精制主食
全谷物、杂豆和大豆可以帮助提升纤维摄入，并改善饱腹感。它们适合成为减脂餐中的稳定组成部分。

## 让日常吃法更稳
不是靠“饿一顿、补一顿”来减脂，而是让每一餐都更均衡、更稳定，减少后续暴食风险。
    `.trim(),
    metadata: {
      chapter: '准则三',
      sourceTitle: '中国居民膳食指南（2022）',
      origin: 'official',
    },
  },
  {
    title: '中国居民膳食指南（2022）- 鱼禽蛋瘦肉与规律进餐',
    authority: '中国营养学会',
    sourceType: 'guideline',
    url: 'https://dg.cnsoc.org/article/04/3tyM8WoTTUmc_oFHMymk3Q.html',
    year: 2022,
    language: 'zh',
    topic: ['nutrition', 'meal_plan'],
    content: `
## 适量吃鱼、禽、蛋、瘦肉
优先选择鱼、禽、蛋和瘦肉等优质蛋白来源，同时控制烹调方式，少油炸、少重油重盐。

## 规律进餐
减脂期更适合规律三餐、控制单餐份量，而不是长期乱吃或完全跳餐。规律进餐更利于执行和饱腹管理。

## 进食方式
在外就餐时应注意荤素搭配、控制总量，优先选择蒸、煮、炖等更清淡的做法。
    `.trim(),
    metadata: {
      chapter: '准则四与准则六',
      sourceTitle: '中国居民膳食指南（2022）',
      origin: 'official',
    },
  },
  {
    title: '中国居民膳食指南（2022）- 吃动平衡与体重管理',
    authority: '中国营养学会',
    sourceType: 'guideline',
    url: 'https://dg.cnsoc.org/article/04/k9W2iu8FT6K5oWaQKArU9g.html',
    year: 2022,
    language: 'zh',
    topic: ['training', 'fat_loss', 'adherence'],
    content: `
## 吃动平衡
体重管理需要把饮食和活动放在一起看。想要更稳定的减脂，不能只改饮食，也不能只靠运动。

## 每周活动建议
建议保持每周至少150分钟的中等强度身体活动，并鼓励每天都有主动活动。抗阻运动也适合纳入计划。

## 少坐、多动
减少久坐、增加日常步行和可持续活动量，往往对平台期和长期维持更有帮助。
    `.trim(),
    metadata: {
      chapter: '准则二延伸',
      sourceTitle: '中国居民膳食指南（2022）',
      origin: 'official',
    },
  },
  {
    title: 'ACSM 成人减重与防止反弹体力活动建议',
    authority: 'American College of Sports Medicine',
    sourceType: 'position_stand',
    url: 'https://www.acsm.org/wp-content/uploads/2025/01/Appropriate-Physical-Activity-Intervention-Strategies-for-Weight-Loss-and-Prevention-of-Weight-Regain-for-Adults.pdf',
    year: 2009,
    language: 'en',
    topic: ['training', 'fat_loss', 'adherence'],
    content: `
## 减重与运动量
对超重和肥胖成人，体力活动是体重控制的重要部分。长期减脂通常需要比单纯健康维持更高的运动量。

## 活动建议
适量饮食控制配合运动，比极端节食更容易形成可持续效果。中等强度活动在长期减重和维持中更有价值。

## 维持体重
减重后要维持成果，通常需要持续较高水平的身体活动，而不是只在开始阶段短期加量。

## 抗阻训练
抗阻训练不一定单独带来很大的体重下降，但它有助于维持瘦体重、改善身体组成和整体风险。
    `.trim(),
    metadata: {
      chapter: 'position stand summary',
      sourceTitle: 'ACSM 成人减重与防止反弹体力活动建议',
      origin: 'official',
    },
  },
  {
    title: 'NASM 平台期与减脂策略',
    authority: 'NASM',
    sourceType: 'professional_blog',
    url: 'https://blog.nasm.org/fitness/weight-loss-plateaus',
    year: 2025,
    language: 'en',
    topic: ['plateau', 'fat_loss', 'adherence'],
    content: `
## 平台期是什么
平台期通常意味着摄入和消耗在一段时间内重新接近持平。它不等于“代谢坏了”，更常见的是能量缺口变小了。

## 常见原因
体重下降后，基础消耗会随体型变化而下降；同时，非运动活动消耗也常常变少。执行力、饥饿感和估算误差也会影响结果。

## 怎么处理
平台期更适合先检查执行，再检查日常活动量和摄入估算。做法通常是温和地重新制造缺口，而不是突然大幅挨饿。

## 可持续目标
减脂速度不宜过激，通常更适合稳定、渐进、可坚持的节奏。这样更利于长期维持。
    `.trim(),
    metadata: {
      chapter: 'weight loss plateaus',
      sourceTitle: 'NASM Weight Loss Plateaus & Strategies to Overcome Them',
      origin: 'official',
    },
  },
  {
    title: 'NASM 蛋白质与减脂',
    authority: 'NASM',
    sourceType: 'professional_blog',
    url: 'https://blog.nasm.org/nutrition/how-much-protein-should-you-eat-per-day-for-weight-loss',
    year: 2025,
    language: 'en',
    topic: ['nutrition', 'meal_plan', 'fat_loss'],
    content: `
## 蛋白质的重要性
蛋白质在减脂中有几个优势：更强的饱腹感、更有利于保留瘦体重、食物热效应更高，也不容易像某些其他宏量营养那样快速转成脂肪储存。

## 推荐范围
减脂期间的实用目标通常可放在约1.6到2.2克每公斤体重附近；运动量大的人群可更高一些，但仍应结合总热量和个人恢复情况。

## 实际应用
蛋白质适合分配到三餐和必要加餐中，作为减脂饮食的稳定骨架，而不是只在某一餐集中补充。
    `.trim(),
    metadata: {
      chapter: 'protein for weight loss',
      sourceTitle: 'NASM How Much Protein Do You Need to Eat Per Day to Lose Weight?',
      origin: 'official',
    },
  },
];

async function main() {
  let imported = 0;
  let skipped = 0;

  for (const source of sources) {
    const checksum = checksumFor(source);
    const existing = await prisma.knowledgeSource.findFirst({ where: { checksum } });
    if (existing) {
      skipped += 1;
      continue;
    }

    const chunks = chunkKnowledgeSource(source);
    const embeddings = await embedTexts(chunks.map(chunk => `${chunk.title}\n${chunk.text}`));

    await prisma.knowledgeSource.create({
      data: {
        title: source.title,
        authority: source.authority,
        sourceType: source.sourceType,
        url: source.url,
        year: source.year,
        language: source.language,
        license: source.license,
        checksum,
        status: 'active',
        chunks: {
          create: chunks.map((chunk, index) => ({
            chunkIndex: chunk.chunkIndex,
            title: chunk.title,
            text: chunk.text,
            summary: chunk.summary,
            topic: chunk.topic,
            metadata: chunk.metadata,
            tokenCount: chunk.tokenCount,
            embedding: embeddings[index] || [],
            embeddingModel: embeddings[index]?.length ? getGLMEmbeddingModel() : undefined,
          })),
        },
      },
    });

    imported += 1;
    console.log(`Imported: ${source.title} (${chunks.length} chunks)`);
  }

  console.log(`Done. imported=${imported}, skipped=${skipped}`);
}

async function embedTexts(texts) {
  const apiKey = process.env.GLM_API_KEY;
  const baseUrl = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
  const model = process.env.GLM_EMBEDDING_MODEL || 'embedding-3';

  if (!apiKey || !texts.length) return texts.map(() => []);

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: texts }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `GLM embedding request failed: ${response.status}`);
    }

    return (data.data || []).map(item => Array.isArray(item.embedding) ? item.embedding : []);
  } catch (error) {
    console.warn(`Embedding fallback for ${texts.length} chunks: ${error instanceof Error ? error.message : String(error)}`);
    return texts.map(() => []);
  }
}

function getGLMEmbeddingModel() {
  return process.env.GLM_EMBEDDING_MODEL || 'embedding-3';
}

function chunkKnowledgeSource(input) {
  const sections = splitIntoSections(normalizeContent(input.content), input.title);
  const chunks = [];
  const topic = normalizeTopic(input.topic);

  for (const section of sections) {
    for (const text of splitSectionText(section.text)) {
      const chunkText = text.trim();
      if (chunkText.length < 120 && chunks.length > 0) {
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
          url: input.url,
        },
        tokenCount: estimateTokenCount(chunkText),
      });
    }
  }

  return chunks.filter(chunk => chunk.text.length >= 120 || chunks.length === 1);
}

function normalizeContent(content) {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoSections(content, fallbackTitle) {
  const lines = content.split('\n');
  const sections = [];
  let currentTitle = fallbackTitle;
  let buffer = [];

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

function splitSectionText(text) {
  const paragraphs = text.split(/\n\s*\n/).map(item => item.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  const target = 760;
  const max = 1200;
  const overlap = 100;

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if ((current.length + paragraph.length + 2) <= target) {
      current = `${current}\n\n${paragraph}`;
    } else {
      chunks.push(...splitLongText(current, target, max, overlap));
      const overlapText = current.slice(Math.max(0, current.length - overlap));
      current = overlapText.length >= 30 ? `${overlapText}\n\n${paragraph}` : paragraph;
    }
  }

  if (current) chunks.push(...splitLongText(current, target, max, overlap));
  return chunks;
}

function splitLongText(text, target, max, overlap) {
  if (text.length <= max) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + target);
    chunks.push(text.slice(start, end));
    start = Math.max(end - overlap, end);
  }
  return chunks;
}

function summarizeChunk(text) {
  return text.replace(/\s+/g, ' ').slice(0, 220);
}

function estimateTokenCount(text) {
  return Math.ceil(text.length / 1.7);
}

function normalizeTopic(topic) {
  const values = Array.isArray(topic) ? topic.map(item => String(item).trim()).filter(Boolean) : [];
  return values.length ? values : ['fat_loss'];
}

function checksumFor(input) {
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

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    if (process.env[key]) continue;
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

process.on('beforeExit', async () => {
  await prisma.$disconnect().catch(() => {});
});

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
});
