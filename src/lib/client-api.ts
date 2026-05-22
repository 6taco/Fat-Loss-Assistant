export async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export async function sendJson<T>(url: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}
