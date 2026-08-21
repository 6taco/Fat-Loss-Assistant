import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { AccountImportError, completeImport } from '@/lib/account-import-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json() as { importId?: string };
    if (!body.importId) return NextResponse.json({ error: 'IMPORT_ID_REQUIRED' }, { status: 400 });
    const result = await completeImport(auth.context.authUserId, body.importId);
    return NextResponse.json({ ok: true, status: result.batch.status, counts: result.counts, profileUserId: result.userId });
  } catch (error) {
    if (error instanceof AccountImportError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: 'IMPORT_SERVICE_UNAVAILABLE' }, { status: 503 });
  }
}
