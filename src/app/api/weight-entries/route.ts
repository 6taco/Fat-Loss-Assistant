import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { toDate, weightToResponse } from '@/lib/server-mappers';
import { WeightEntry } from '@/lib/mock-data';
import { requireBusinessUser } from '@/lib/auth-server';

interface WeightBody extends WeightEntry {
  userId?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const entries = await prisma.weightEntry.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ entries: entries.map(weightToResponse), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), entries: [] }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as WeightBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;
  if (!body.date || !body.weight) {
    return NextResponse.json({ error: 'date and weight are required' }, { status: 400 });
  }

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
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
