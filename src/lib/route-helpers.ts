import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

const DATABASE_UNAVAILABLE_MESSAGE = '数据库暂时不可用，请稍后重试';

// Single place that decides what an API route may reveal in an error response.
// Prisma/driver internals (table names, hosts, SQL) never reach the client;
// the original message is logged server-side instead.
export function getRouteErrorMessage(error: unknown, fallback = 'Request failed'): string {
  const message = error instanceof Error ? error.message : '';
  if (!message) return fallback;
  if (isDatabaseError(error) || message.includes('DATABASE_URL')) {
    console.error('[api] database error sanitized for response:', message);
    return DATABASE_UNAVAILABLE_MESSAGE;
  }
  return message;
}

function isDatabaseError(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return (typeof code === 'string' && /^P\d{4}$/.test(code)) // Prisma
    || typeof (error as { errno?: unknown })?.errno === 'number'; // mariadb driver
}

// Parses and validates a JSON request body against a zod schema. Malformed
// JSON and schema violations return a 400 response instead of throwing into
// an unhandled 500.
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: NextResponse.json({ error: '请求格式不正确' }, { status: 400 }) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({
        error: 'Invalid request body',
        details: parsed.error.issues.map(issue => `${issue.path.join('.') || 'body'}: ${issue.message}`),
      }, { status: 400 }),
    };
  }
  return { ok: true, data: parsed.data };
}

// Clamps an optional ?limit= query param for list endpoints so a response can
// never grow unbounded.
export function getQueryLimit(searchParams: URLSearchParams, defaultLimit: number, maxLimit: number): number {
  const requested = Number(searchParams.get('limit'));
  if (!Number.isFinite(requested) || requested <= 0) return defaultLimit;
  return Math.min(Math.round(requested), maxLimit);
}
