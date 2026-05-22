import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import { toDate, userToResponse } from '@/lib/server-mappers';
import { mockUser, UserProfile } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ user: mockUser, source: 'mock' });
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ user: null, source: 'local' });

    return NextResponse.json({ user: userToResponse(user), source: 'db' });
  } catch (error) {
    return NextResponse.json({ user: null, source: 'local', warning: getErrorMessage(error) });
  }
}

export async function POST(request: NextRequest) {
  const user = (await request.json()) as Partial<UserProfile>;
  const trainingSchedule = user.trainingSchedule as Prisma.InputJsonValue | undefined;

  if (!user.gender || !user.age || !user.height || !user.weight || !user.bodyFat) {
    return NextResponse.json({ error: 'Missing required user profile fields' }, { status: 400 });
  }

  try {
    const prisma = getPrisma();

    const saved = await prisma.user.upsert({
      where: { id: user.id || `user-${Date.now()}` },
      create: {
        id: user.id || `user-${Date.now()}`,
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
    const localUser: UserProfile = {
      id: user.id || `user-${Date.now()}`,
      name: user.name || 'Alex',
      gender: user.gender,
      age: user.age,
      height: user.height,
      weight: user.weight,
      bodyFat: user.bodyFat,
      trainingFrequency: user.trainingFrequency || 4,
      trainingIntensity: user.trainingIntensity || 'medium',
      startDate: user.startDate || new Date().toISOString().slice(0, 10),
      initialWeightDate: user.initialWeightDate,
      goalWeight: user.goalWeight || Math.round(user.weight * 0.9),
      somatotype: user.somatotype || 'mesomorph',
      trainingSchedule: user.trainingSchedule || [],
    };

    return NextResponse.json({ user: localUser, source: 'local', warning: getErrorMessage(error) });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Database request failed';
}
