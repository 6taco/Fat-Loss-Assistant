import { NextRequest, NextResponse } from 'next/server';
import { listDigitalTwinScenarios } from '@/lib/digital-twin/service';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const scenarios = await listDigitalTwinScenarios(userId);
    return NextResponse.json({ scenarios });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Digital twin scenarios request failed' }, { status: 500 });
  }
}
