import { setTimeout as sleep } from 'node:timers/promises';

export type FetchLike = typeof fetch;

export async function postJsonWithRetry<T>(args: {
  fetchImpl: FetchLike;
  url: string;
  body: unknown;
  headers?: Record<string, string>;
  timeoutMs: number;
  retryCount: number;
}): Promise<{ ok: true; status: number; payload: T } | { ok: false; status: number; bodyText: string }> {
  const attempts = args.retryCount + 1;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), args.timeoutMs);
    try {
      const response = await args.fetchImpl(args.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(args.headers || {}),
        },
        body: JSON.stringify(args.body),
        signal: abort.signal,
      });
      clearTimeout(timer);

      const text = await response.text();
      if (!response.ok) {
        return { ok: false, status: response.status, bodyText: text };
      }
      const payload = text ? (JSON.parse(text) as T) : ({} as T);
      return { ok: true, status: response.status, payload };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep((attempt + 1) * 200);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('unknown network error');
}
