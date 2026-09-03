import { NextRequest, NextResponse } from 'next/server';
import { generateWeightPrediction } from '@/lib/weight-prediction';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

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
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Weight prediction failed'), prediction: null, source: 'db' }, { status: 503 });
  }
}

