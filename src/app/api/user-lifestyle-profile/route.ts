import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { lifestyleToResponse } from '@/lib/strategy-engine/mappers';
import { upsertLifestyleProfile } from '@/lib/strategy-engine/service';
import type { UserLifestyleProfile } from '@/lib/strategy-engine/types';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('userId'));
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const profile = await prisma.userLifestyleProfile.findUnique({ where: { userId } });
    return NextResponse.json({ profile: profile ? lifestyleToResponse(profile) : null, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Lifestyle profile request failed'), profile: null }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as Partial<UserLifestyleProfile> & { userId?: string };
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;

  try {
    const profile = await upsertLifestyleProfile(auth.context.userId!, body);
    return NextResponse.json({ profile, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Lifestyle profile request failed') }, { status: 503 });
  }
}

