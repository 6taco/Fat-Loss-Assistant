import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage } from '@/lib/route-helpers';

interface ReadBody {
  userId?: string;
  type?: 'daily' | 'weekly';
  id?: string;
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as ReadBody;
  if (!body.type || !body.id) {
    return NextResponse.json({ error: 'type and id are required' }, { status: 400 });
  }
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const prisma = getPrisma();
    const readAt = new Date();

    if (body.type === 'daily') {
      const report = await prisma.dailyReport.findFirst({ where: { id: body.id, userId } });
      if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      await prisma.dailyReport.update({
        where: { id: report.id },
        data: { readAt },
      });
    } else {
      const report = await prisma.weeklyReport.findFirst({ where: { id: body.id, userId } });
      if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      await prisma.weeklyReport.update({
        where: { id: report.id },
        data: { readAt },
      });
    }

    return NextResponse.json({ id: body.id, type: body.type, readAt: readAt.toISOString(), source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Report read update failed') }, { status: 503 });
  }
}

