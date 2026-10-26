const UA = 'SharpDeals/0.1 (personal price comparison; contact: jacquesearle@icloud.com)';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polite JSON request: identifies itself, retries with backoff on 429/5xx. */
export async function requestJson<T>(url: string, init: RequestInit = {}, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...init.headers },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) return (await res.json()) as T;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) throw new Error(`${res.status} ${res.statusText} for ${url.slice(0, 120)}`);
    await sleep(1500 * 2 ** attempt);
  }
}
