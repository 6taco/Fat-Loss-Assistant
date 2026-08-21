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
  console.error('[auth] request failed', error instanceof Error ? error.message : 'Unknown error');
  return Response.json({ error: 'AUTH_SERVICE_UNAVAILABLE' }, { status: 503 });
}
