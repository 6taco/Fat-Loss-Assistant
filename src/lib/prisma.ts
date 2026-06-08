import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export function getPrisma() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for database-backed API routes');
  }

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaMariaDb(buildMariaDbConfig(databaseUrl));
    globalForPrisma.prisma = new PrismaClient({
      adapter,
      errorFormat: 'minimal',
    });
  }

  return globalForPrisma.prisma;
}

function buildMariaDbConfig(databaseUrl: string): ConstructorParameters<typeof PrismaMariaDb>[0] {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('ssl-mode') || url.searchParams.get('sslmode');
  const ca = process.env.DATABASE_CA_CERT || process.env.AIVEN_CA_CERT;

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT || 2),
    minimumIdle: 0,
    prepareCacheLength: 0,
    acquireTimeout: Number(process.env.DATABASE_ACQUIRE_TIMEOUT_MS || 20000),
    connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 10000),
    ssl: sslMode || ca
      ? ca
        ? { ca, rejectUnauthorized: true }
        : { rejectUnauthorized: false }
      : undefined,
  };
}
