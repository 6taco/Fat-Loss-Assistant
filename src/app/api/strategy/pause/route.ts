import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { requireBusinessUser } from '@/lib/auth-server';
import { getRouteErrorMessage, parseJsonBody } from '@/lib/route-helpers';

const bodySchema = z.object({ userId: z.string().optional() });

// Maintenance-phase transition: pausing the active strategy switches the
// client back to computed recommendations; a later recheck or activation
// resumes a concrete plan.
export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const auth = await requireBusinessUser(request, parsed.data.userId);
  if (auth.response) return auth.response;

  try {
    const result = await getPrisma().fatLossStrategyProfile.updateMany({
      where: { userId: auth.context.userId!, status: 'active' },
      data: { status: 'paused', endDate: new Date() },
    });
    return NextResponse.json({ paused: result.count, source: 'db' });
  } catch (error) {
    return NextResponse.json({ error: getRouteErrorMessage(error, 'Strategy pause failed') }, { status: 503 });
  }
}
