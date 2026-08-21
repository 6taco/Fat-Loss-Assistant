import { NextRequest, NextResponse } from 'next/server';
import { generateShoppingList } from '@/lib/coach';
import { dateToISODate } from '@/lib/server-mappers';
import { requireBusinessUser } from '@/lib/auth-server';

interface GenerateShoppingListBody {
  userId?: string;
  startDate?: string;
  days?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateShoppingListBody;
  const auth = await requireBusinessUser(request, body.userId);
  if (auth.response) return auth.response;
  const userId = auth.context.userId!;

  try {
    const list = await generateShoppingList(userId, body.startDate || dateToISODate(new Date()), body.days || 3);
    return NextResponse.json({
      shoppingList: {
        id: list.id,
        userId,
        startDate: dateToISODate(list.startDate),
        endDate: dateToISODate(list.endDate),
        items: list.items,
        source: list.source,
        createdAt: list.createdAt.toISOString(),
      },
      source: 'db',
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Shopping list generation failed';
}
