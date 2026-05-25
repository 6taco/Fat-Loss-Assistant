import { NextRequest, NextResponse } from 'next/server';
import { generateWeightPrediction } from '@/lib/weight-prediction';

interface GeneratePredictionBody {
  userId?: string;
  horizonDays?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GeneratePredictionBody;
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const prediction = await generateWeightPrediction(body.userId, 30);
    return NextResponse.json({ prediction, source: 'db' });
  } catch (error) {
    return NextResponse.json({ prediction: null, source: 'local', warning: getErrorMessage(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Weight prediction failed';
}
