// src/lib/stores/_fetcher.ts
export type FetchCache<T> = {
  data?: T;
  timestamp?: number;
  promise?: Promise<T>;
};

export function createFetcher<T>(url: string, ttl = 1000 * 60 * 5) {
  const cache: FetchCache<T> = {};

  return {
    async fetch(force = false) {
      const now = Date.now();
      if (!force && cache.data && cache.timestamp && now - cache.timestamp < ttl) {
        return cache.data as T;
      }
      if (cache.promise && !force) return cache.promise as Promise<T>;

      cache.promise = (async () => {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Failed to fetch ${url}: ${res.status} ${text}`);
        }
        const json = await res.json().catch(() => ({}));
        cache.data = (json?.data ?? json) as T;
        cache.timestamp = Date.now();
        cache.promise = undefined;
        return cache.data as T;
      })();

      return cache.promise as Promise<T>;
    },
    clear() {
      cache.data = undefined;
      cache.timestamp = undefined;
      cache.promise = undefined;
    }
  };
}
