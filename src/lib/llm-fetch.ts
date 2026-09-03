interface LlmFetchOptions {
  label: string;
  timeoutMs: number;
  retries?: number;
}

export interface LlmFetchResult {
  ok: boolean;
  status: number;
  json: unknown;
}

// Shared transport for chat-completion style endpoints: per-attempt timeout,
// one retry on transient failures (network resets, 429, 5xx). Timeouts are not
// retried — a slow model would simply burn the timeout again.
export async function llmFetchJson(url: string, init: RequestInit, options: LlmFetchOptions): Promise<LlmFetchResult> {
  const maxAttempts = (options.retries ?? 1) + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(options.timeoutMs) });
    } catch (error) {
      if (attempt >= maxAttempts || isTimeout(error)) throw error;
      await delay(500 * attempt);
      continue;
    }

    if (!response.ok && isRetryableStatus(response.status) && attempt < maxAttempts) {
      await delay(500 * attempt);
      continue;
    }

    try {
      const json = await response.json();
      return { ok: response.ok, status: response.status, json };
    } catch {
      // Upstream returned a non-JSON body (e.g. an HTML error page).
      throw new Error(`${options.label} returned a non-JSON response (HTTP ${response.status})`);
    }
  }

  throw new Error(`${options.label} request failed after ${maxAttempts} attempts`);
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

function isTimeout(error: unknown) {
  return error instanceof Error && error.name === 'TimeoutError';
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
