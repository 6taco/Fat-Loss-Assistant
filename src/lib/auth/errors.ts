export class AuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
    message = code,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.code }, { status: error.status });
  }
  const code = getAuthServiceErrorCode(error);
  console.error('[auth] request failed', code);
  return Response.json({ error: code }, { status: 503 });
}

function getAuthServiceErrorCode(error: unknown) {
  const details = error as { code?: unknown; message?: unknown };
  const prismaCode = typeof details?.code === 'string' ? details.code : '';
  const message = typeof details?.message === 'string' ? details.message : '';

  if (message.includes('DATABASE_URL is required')) return 'AUTH_DATABASE_NOT_CONFIGURED';
  if (prismaCode === 'P2021' || /table .* does not exist|doesn't exist/i.test(message)) {
    return 'AUTH_DATABASE_MIGRATION_REQUIRED';
  }
  return 'AUTH_DATABASE_UNAVAILABLE';
}
