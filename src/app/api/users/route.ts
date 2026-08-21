import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { toDate, userToResponse } from '@/lib/server-mappers';
import { UserProfile } from '@/lib/mock-data';
import { requireAuth, requireBusinessUser } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const auth = await requireBusinessUser(request, request.nextUrl.searchParams.get('id'));
  if (auth.response) return auth.response;
  const id = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });

    return NextResponse.json({ user: userToResponse(user), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = (await request.json()) as Partial<UserProfile>;
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const trainingSchedule = user.trainingSchedule as Prisma.InputJsonValue | undefined;

  if (!user.gender || !user.age || !user.height || !user.weight || !user.bodyFat) {
    return NextResponse.json({ error: 'Missing required user profile fields' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();

    const saved = await prisma.user.upsert({
      where: { authUserId: auth.context.authUserId },
      create: {
        authUserId: auth.context.authUserId,
        name: user.name || 'Alex',
        gender: user.gender,
        age: user.age,
        height: user.height,
        weight: user.weight,
        bodyFat: user.bodyFat,
        trainingFrequency: user.trainingFrequency || 4,
        trainingIntensity: user.trainingIntensity || 'medium',
        startDate: toDate(user.startDate || new Date().toISOString().slice(0, 10)),
        initialWeightDate: user.initialWeightDate ? toDate(user.initialWeightDate) : null,
        goalWeight: user.goalWeight || Math.round(user.weight * 0.9),
        somatotype: user.somatotype || 'mesomorph',
        trainingSchedule,
      },
      update: {
        name: user.name || 'Alex',
        gender: user.gender,
        age: user.age,
        height: user.height,
        weight: user.weight,
        bodyFat: user.bodyFat,
        trainingFrequency: user.trainingFrequency || 4,
        trainingIntensity: user.trainingIntensity || 'medium',
        startDate: toDate(user.startDate || new Date().toISOString().slice(0, 10)),
        initialWeightDate: user.initialWeightDate ? toDate(user.initialWeightDate) : null,
        goalWeight: user.goalWeight || Math.round(user.weight * 0.9),
        somatotype: user.somatotype || 'mesomorph',
        trainingSchedule,
      },
    });

    return NextResponse.json({ user: userToResponse(saved), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: 'PROFILE_SAVE_FAILED', warning: getErrorMessage(error) }, { status: 503 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
