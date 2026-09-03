import { NextRequest, NextResponse } from 'next/server';
import { runDailyCoach } from '@/lib/coach';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

interface RunDailyBody {
  userId?: string;
  date?: string;
  force?: boolean;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RunDailyBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const result = await runDailyCoach({ userId, date: body.date, force: Boolean(body.force) });
    return NextResponse.json({ ...result, source: 'db' });
  } catch (error) {
    return NextResponse.json({
      feed: { insights: [], proposals: [], notifications: [], memories: [] },
      source: 'db',
      warning: getRouteErrorMessage(error, '每日教练分析暂时无法写入数据库'),
    }, { status: 503 });
  }
}

