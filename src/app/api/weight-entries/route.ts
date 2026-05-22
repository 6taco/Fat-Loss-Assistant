import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { toDate, weightToResponse } from '@/lib/server-mappers';
import { WeightEntry, mockWeightLog } from '@/lib/mock-data';

interface WeightBody extends WeightEntry {
  userId?: string;
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const entries = await prisma.weightEntry.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ entries: entries.map(weightToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ entries: [], source: 'local', warning: getErrorMessage(error) });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as WeightBody;
  if (!body.userId || !body.date || !body.weight) {
    return NextResponse.json({ error: 'userId, date and weight are required' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();

    const entry = await prisma.weightEntry.upsert({
      where: {
        userId_date: {
          userId: body.userId,
          date: toDate(body.date),
        },
      },
      create: {
        userId: body.userId,
        date: toDate(body.date),
        weight: body.weight,
      },
      update: {
        weight: body.weight,
      },
    });

    return NextResponse.json({ entry: weightToResponse(entry), source: 'db' });
  } catch (error) {
    return NextResponse.json({
      entry: mockWeightLog.find(entry => entry.date === body.date) || { date: body.date, weight: body.weight },
      source: 'local',
      warning: getErrorMessage(error),
    });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
