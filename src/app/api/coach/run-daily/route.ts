import { NextRequest, NextResponse } from 'next/server';
import { runDailyCoach } from '@/lib/coach';

interface RunDailyBody {
  userId?: string;
  date?: string;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RunDailyBody;
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const result = await runDailyCoach({ userId: body.userId, date: body.date, force: Boolean(body.force) });
    return NextResponse.json({ ...result, source: 'db' });
  } catch (error) {
    return NextResponse.json({
      feed: { insights: [], proposals: [], notifications: [], memories: [] },
      source: 'local',
      warning: getErrorMessage(error),
    });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '每日教练分析暂时无法写入数据库';
}
