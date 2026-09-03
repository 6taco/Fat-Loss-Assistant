import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { toDate, weightToResponse } from '@/lib/server-mappers';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage, getQueryLimit, parseJsonBody } from '@/lib/route-helpers';

const weightBodySchema = z.object({
  userId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  weight: z.number().min(20).max(500),
});

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const limit = getQueryLimit(request.nextUrl.searchParams, 1000, 2000);
    // Newest-first take, then reversed back to chronological order.
    const entries = (await prisma.weightEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    })).reverse();

    return NextResponse.json({ entries: entries.map(weightToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed'), entries: [] }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, weightBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();

    const entry = await prisma.weightEntry.upsert({
      where: {
        userId_date: {
          userId,
          date: toDate(body.date),
        },
      },
      create: {
        userId,
        date: toDate(body.date),
        weight: body.weight,
      },
      update: {
        weight: body.weight,
      },
    });

    return NextResponse.json({ entry: weightToResponse(entry), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed') }, { status: 503 });
  }
}
