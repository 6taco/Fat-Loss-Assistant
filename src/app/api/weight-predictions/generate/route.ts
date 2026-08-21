import { NextRequest, NextResponse } from 'next/server';
import { generateWeightPrediction } from '@/lib/weight-prediction';
import { requireBusinessUser } from '@/lib/auth-server';

interface GeneratePredictionBody {
  userId?: string;
  horizonDays?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GeneratePredictionBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prediction = await generateWeightPrediction(userId, body.horizonDays || 30);
    return NextResponse.json({ prediction, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), prediction: null, source: 'db' }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Weight prediction failed';
}
