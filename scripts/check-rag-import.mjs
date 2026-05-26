import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

loadEnv(path.join(projectRoot, '.env'));
loadEnv(path.join(projectRoot, '.env.local'));

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
  errorFormat: 'minimal',
});

async function main() {
  const [sources, chunks] = await Promise.all([
    prisma.knowledgeSource.count(),
    prisma.knowledgeChunk.count(),
  ]);

  const recent = await prisma.knowledgeSource.findMany({
    select: { title: true, authority: true, sourceType: true, year: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(JSON.stringify({ sources, chunks, recent }, null, 2));
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
    process.env[key] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
