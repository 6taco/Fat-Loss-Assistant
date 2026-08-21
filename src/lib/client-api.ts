export class ApiError extends Error {
  constructor(public status: number, public code?: string) {
    super(code || `Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

export async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw await toApiError(response);
    return await response.json() as T;
  } catch (error) {
    handleAuthError(error);
    return null;
  }
}

export async function sendJson<T>(url: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await toApiError(response);
    const data = await response.json() as T;
    return data;
  } catch (error) {
    handleAuthError(error);
    return null;
  }
}

async function toApiError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return new ApiError(response.status, body?.error);
}

function handleAuthError(error: unknown) {
  if (typeof window === 'undefined' || !(error instanceof ApiError)) return;
  if (error.status === 401) window.dispatchEvent(new CustomEvent('auth-expired'));
}
