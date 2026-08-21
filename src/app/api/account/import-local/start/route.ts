import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { AccountImportError, startImport } from '@/lib/account-import-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json() as { sourceAccountId?: string; datasets?: unknown };
    const batch = await startImport(auth.context.authUserId, body);
    return NextResponse.json({ importId: batch.id, status: batch.status });
  } catch (error) {
    return importErrorResponse(error);
  }
}

function importErrorResponse(error: unknown) {
  if (error instanceof AccountImportError) return NextResponse.json({ error: error.code }, { status: error.status });
  return NextResponse.json({ error: 'IMPORT_SERVICE_UNAVAILABLE' }, { status: 503 });
}
