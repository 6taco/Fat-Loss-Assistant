import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { toDate, userToResponse } from '@/lib/server-mappers';
import { requireAuth, requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage, parseJsonBody } from '@/lib/route-helpers';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

const userProfileBodySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(50).optional(),
  gender: z.enum(['male', 'female']),
  age: z.number().int().min(10).max(100),
  height: z.number().min(100).max(250),
  weight: z.number().min(25).max(400),
  bodyFat: z.number().min(0).max(70),
  trainingFrequency: z.number().int().min(0).max(7).optional(),
  trainingIntensity: z.enum(['low', 'medium', 'high']).optional(),
  startDate: isoDate.optional(),
  initialWeightDate: isoDate.optional(),
  goalWeight: z.number().min(25).max(400).optional(),
  somatotype: z.enum(['endomorph', 'mesomorph', 'ectomorph']).optional(),
  trainingSchedule: z.array(z.object({
    dayIndex: z.number().int().min(0).max(365),
    muscleGroup: z.enum(['legs', 'back', 'chest', 'shoulders', 'arms', 'core', 'cardio', 'rest']),
    label: z.string().max(50).optional(),
    cycleMode: z.enum(['rhythm']).optional(),
    trainingStreak: z.number().int().min(1).max(6).optional(),
  })).max(60).optional(),
});

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
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Database request failed') }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, userProfileBodySchema);
  if (!parsed.ok) return parsed.response;
  const user = parsed.data;
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const trainingSchedule = user.trainingSchedule as unknown as Prisma.InputJsonValue | undefined;

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
    return NextResponse.json({ error: 'PROFILE_SAVE_FAILED', warning: getRouteErrorMessage(error, 'Database request failed') }, { status: 503 });
  }
}
