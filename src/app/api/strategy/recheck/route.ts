import { NextRequest, NextResponse } from 'next/server';
import { recheckStrategy } from '@/lib/strategy-engine/service';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

export async function POST(request: NextRequest) {
  const body = await request.json() as { userId?: string };
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;

  try {
    const data = await recheckStrategy(auth.context.userId!);
    return NextResponse.json({ ...data, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Strategy recheck failed'), source: 'local' }, { status: 503 });
  }
}

