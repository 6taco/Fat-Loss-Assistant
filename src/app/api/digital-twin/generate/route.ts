import { NextRequest, NextResponse } from 'next/server';
import { generateDigitalTwin } from '@/lib/digital-twin/service';

interface GenerateBody {
  userId?: string;
  horizonDays?: number;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateBody;
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const twin = await generateDigitalTwin(body.userId, {
      horizonDays: body.horizonDays || 30,
      force: Boolean(body.force),
    });
    return NextResponse.json(twin);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Digital twin generate failed' }, { status: 500 });
  }
}
