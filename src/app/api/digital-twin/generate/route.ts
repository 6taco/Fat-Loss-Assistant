import { NextRequest, NextResponse } from 'next/server';
import { generateDigitalTwin } from '@/lib/digital-twin/service';
import { requireBusinessUser } from '@/lib/auth-server';

interface GenerateBody {
  userId?: string;
  horizonDays?: number;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const twin = await generateDigitalTwin(userId, {
      horizonDays: body.horizonDays || 30,
      force: Boolean(body.force),
    });
    return NextResponse.json(twin);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Digital twin generate failed' }, { status: 500 });
  }
}
