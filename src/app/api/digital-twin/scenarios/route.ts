import { NextRequest, NextResponse } from 'next/server';
import { listDigitalTwinScenarios } from '@/lib/digital-twin/service';
import { requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const scenarios = await listDigitalTwinScenarios(userId);
    return NextResponse.json({ scenarios });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Digital twin scenarios request failed' }, { status: 500 });
  }
}
