import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { runDailyCoach } from '@/lib/coach';
import { requireCron } from '@/lib/auth-server';
import { mapWithConcurrency } from '@/lib/concurrency';

// Each coach run issues several DB queries plus one LLM call, while the
// MariaDB pool defaults to 2 connections — unbounded concurrency starves it.
const USER_CONCURRENCY = 3;

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authResponse = requireCron(request);
  if (authResponse) return authResponse;

  const prisma = getPrisma();
  const users = await prisma.user.findMany({ select: { id: true } });
  const results = await mapWithConcurrency(users, USER_CONCURRENCY, user => runDailyCoach({ userId: user.id }));
  return NextResponse.json({ users: users.length, completed: results.filter(result => result.status === 'fulfilled').length });
}
