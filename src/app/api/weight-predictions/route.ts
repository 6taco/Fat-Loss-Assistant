import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { weightPredictionRecordToDto } from '@/lib/weight-prediction';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const latest = request.nextUrl.searchParams.get('latest') !== 'false';
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = Math.max(1, Math.min(30, Number.parseInt(limitParam || '10', 10) || 10));

  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const predictions = await prisma.weightPrediction.findMany({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
      take: latest ? 1 : limit,
    });
    return NextResponse.json({ predictions: predictions.map(weightPredictionRecordToDto), source: 'db' });
  } catch (error) {
    return NextResponse.json({ predictions: [], source: 'local', warning: getErrorMessage(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
