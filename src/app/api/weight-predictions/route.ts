import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { weightPredictionRecordToDto } from '@/lib/weight-prediction';
import { requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const requestedUserId = request.nextUrl.searchParams.get('userId');
  const latest = request.nextUrl.searchParams.get('latest') !== 'false';
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = Math.max(1, Math.min(30, Number.parseInt(limitParam || '10', 10) || 10));

  const auth = await requireBusinessUser(request, requestedUserId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const predictions = await prisma.weightPrediction.findMany({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
      take: latest ? 1 : limit,
    });
    return NextResponse.json({ predictions: predictions.map(weightPredictionRecordToDto), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), predictions: [] }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
