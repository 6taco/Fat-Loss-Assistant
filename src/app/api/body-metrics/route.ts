import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { toDate } from '@/lib/server-mappers';
import type { BodyMetricEntry } from '@/lib/types';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage, getQueryLimit, parseJsonBody } from '@/lib/route-helpers';

const percent = z.number().min(2, '体脂率需在 2-70% 之间').max(70);
const cm = z.number().min(20, '围度需在 20-250cm 之间').max(250);

const bodySchema = z.object({
  userId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  bodyFat: percent.optional(),
  waistCm: cm.optional(),
  hipCm: cm.optional(),
  chestCm: cm.optional(),
  armCm: cm.optional(),
}).refine(value => value.bodyFat !== undefined || value.waistCm !== undefined || value.hipCm !== undefined
  || value.chestCm !== undefined || value.armCm !== undefined, {
  message: '至少填写一项身体数据',
});

function toResponse(entry: {
  id: string;
  date: Date;
  bodyFat: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armCm: number | null;
}): BodyMetricEntry {
  return {
    id: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    bodyFat: entry.bodyFat ?? undefined,
    waistCm: entry.waistCm ?? undefined,
    hipCm: entry.hipCm ?? undefined,
    chestCm: entry.chestCm ?? undefined,
    armCm: entry.armCm ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const limit = getQueryLimit(request.nextUrl.searchParams, 200, 500);
    const entries = (await prisma.bodyMetricEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    })).reverse();
    return NextResponse.json({ entries: entries.map(toResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed'), entries: [] }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const data = {
      bodyFat: body.bodyFat,
      waistCm: body.waistCm,
      hipCm: body.hipCm,
      chestCm: body.chestCm,
      armCm: body.armCm,
    };
    // Same-day entries overwrite; blank fields keep the stored value so a
    // waist-only update does not erase previously logged fat/hip data.
    const entry = await prisma.bodyMetricEntry.upsert({
      where: { userId_date: { userId, date: toDate(body.date) } },
      create: { userId, date: toDate(body.date), ...data },
      update: {
        bodyFat: data.bodyFat ?? undefined,
        waistCm: data.waistCm ?? undefined,
        hipCm: data.hipCm ?? undefined,
        chestCm: data.chestCm ?? undefined,
        armCm: data.armCm ?? undefined,
      },
    });
    return NextResponse.json({ entry: toResponse(entry), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed') }, { status: 503 });
  }
}
