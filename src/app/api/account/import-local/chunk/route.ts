import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { AccountImportError, storeImportChunk } from '@/lib/account-import-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json() as {
      importId?: string;
      dataset?: string;
      chunkIndex?: number;
      items?: unknown;
    };
    const chunk = await storeImportChunk(auth.context.authUserId, body);
    return NextResponse.json({ ok: true, chunkId: chunk.id, dataset: chunk.dataset, chunkIndex: chunk.chunkIndex });
  } catch (error) {
    if (error instanceof AccountImportError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: 'IMPORT_SERVICE_UNAVAILABLE' }, { status: 503 });
  }
}
