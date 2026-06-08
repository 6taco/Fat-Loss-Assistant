import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { NextResponse } from 'next/server';
import * as mariadb from 'mariadb';
import { buildMariaDbConfig } from '@/lib/prisma';

export const runtime = 'nodejs';

type StepResult = {
  ok: boolean;
  ms: number;
  result?: unknown;
  error?: string;
};

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL is not configured.' }, { status: 500 });
  }

  const url = new URL(databaseUrl);
  const host = url.hostname;
  const port = Number(url.port || 3306);
  const config = buildMariaDbConfig(databaseUrl);

  const dns = await measure(() => lookup(host));
  const tcp = await measure(() => testTcp(host, port, 5000));
  const mysql = await measure(async () => {
    const connection = await mariadb.createConnection(config as Parameters<typeof mariadb.createConnection>[0]);
    try {
      const rows = await connection.query('SELECT 1 AS ok');
      return { rows };
    } finally {
      await connection.end();
    }
  });

  return NextResponse.json({
    ok: Boolean(dns.ok && tcp.ok && mysql.ok),
    target: {
      host,
      port,
      database: url.pathname.replace(/^\//, ''),
      user: url.username ? `${url.username.slice(0, 2)}***` : '',
      sslMode: url.searchParams.get('ssl-mode') || url.searchParams.get('sslmode') || null,
      hasCaCert: Boolean(process.env.DATABASE_CA_CERT || process.env.AIVEN_CA_CERT),
      connectionLimit: config && typeof config === 'object' && 'connectionLimit' in config ? config.connectionLimit : null,
    },
    steps: { dns, tcp, mysql },
  }, { status: dns.ok && tcp.ok && mysql.ok ? 200 : 500 });
}

async function measure<T>(fn: () => Promise<T>): Promise<StepResult> {
  const started = Date.now();
  try {
    const result = await fn();
    return { ok: true, ms: Date.now() - started, result };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, error: getErrorMessage(error) };
  }
}

function testTcp(host: string, port: number, timeoutMs: number) {
  return new Promise<{ remoteAddress?: string; remotePort?: number }>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TCP connection timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      const result = { remoteAddress: socket.remoteAddress, remotePort: socket.remotePort };
      socket.end();
      resolve(result);
    });
    socket.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
