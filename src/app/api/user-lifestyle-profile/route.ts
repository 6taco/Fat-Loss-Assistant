import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { lifestyleToResponse } from '@/lib/strategy-engine/mappers';
import { upsertLifestyleProfile } from '@/lib/strategy-engine/service';
import type { UserLifestyleProfile } from '@/lib/strategy-engine/types';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const prisma = getPrisma();
    const profile = await prisma.userLifestyleProfile.findUnique({ where: { userId } });
    return NextResponse.json({ profile: profile ? lifestyleToResponse(profile) : null, source: 'db' });
  } catch (error) {
    return NextResponse.json({ profile: null, source: 'local', warning: getErrorMessage(error) });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as Partial<UserLifestyleProfile> & { userId?: string };
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const profile = await upsertLifestyleProfile(body.userId, body);
    return NextResponse.json({ profile, source: 'db' });
  } catch (error) {
    return NextResponse.json({ profile: body, source: 'local', warning: getErrorMessage(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Lifestyle profile request failed';
}
