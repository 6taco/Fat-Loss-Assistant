import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { runDailyCoach } from '@/lib/coach';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}` && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const users = await prisma.user.findMany({ select: { id: true } });
  const results = await Promise.allSettled(users.map(user => runDailyCoach({ userId: user.id })));
  return NextResponse.json({ users: users.length, completed: results.filter(result => result.status === 'fulfilled').length });
}
