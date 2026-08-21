import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { runDailyCoach } from '@/lib/coach';
import { requireCron } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const authResponse = requireCron(request);
  if (authResponse) return authResponse;

  const prisma = getPrisma();
  const users = await prisma.user.findMany({ select: { id: true } });
  const results = await Promise.allSettled(users.map(user => runDailyCoach({ userId: user.id })));
  return NextResponse.json({ users: users.length, completed: results.filter(result => result.status === 'fulfilled').length });
}
