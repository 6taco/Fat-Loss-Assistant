import { NextRequest, NextResponse } from 'next/server';
import { generateShoppingList } from '@/lib/coach';
import { dateToISODate } from '@/lib/server-mappers';

interface GenerateShoppingListBody {
  userId?: string;
  startDate?: string;
  days?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateShoppingListBody;
  if (!body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  try {
    const list = await generateShoppingList(body.userId, body.startDate || dateToISODate(new Date()), body.days || 3);
    return NextResponse.json({
      shoppingList: {
        id: list.id,
        userId: list.userId,
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
