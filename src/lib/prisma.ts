import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export function getPrisma() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for database-backed API routes');
  }

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaMariaDb(databaseUrl);
    globalForPrisma.prisma = new PrismaClient({
      adapter,
      errorFormat: 'minimal',
    });
  }

  return globalForPrisma.prisma;
}
