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

      // Return cached data if still fresh and not forcing
      if (!force && cache.data && cache.timestamp && now - cache.timestamp < ttl) {
        // console.log(`[Fetcher] Using cached data for ${url} (age: ${now - cache.timestamp}ms)`);
        return cache.data as T;
      }

      // Return existing promise if one is in flight (deduplication)
      if (cache.promise && !force) {
        // console.log(`[Fetcher] Reusing in-flight request for ${url}`);
        return cache.promise as Promise<T>;
      }

      // console.log(`[Fetcher] Making fresh request to ${url}`);

      cache.promise = (async () => {
        try {
          const res = await fetch(url, { credentials: 'same-origin' });

          if (!res.ok) {
            const text = await res.text().catch(() => '');
            // Fixed: Use proper Error constructor syntax
            throw new Error(`Failed to fetch ${url}: ${res.status} ${text}`);
          }

          const json = await res.json().catch(() => ({}));
          cache.data = (json?.data ?? json) as T;
          cache.timestamp = Date.now();
          cache.promise = undefined;

          // console.log(`[Fetcher] Successfully fetched ${url}`, cache.data);
          return cache.data as T;
        } catch (err) {
          // Clear promise on error so retry is possible
          cache.promise = undefined;
          console.error(`[Fetcher] Error fetching ${url}:`, err);
          throw err;
        }
      })();

      return cache.promise as Promise<T>;
    },

    clear() {
      // console.log(`[Fetcher] Clearing cache for ${url}`);
      cache.data = undefined;
      cache.timestamp = undefined;
      cache.promise = undefined;
    },

    // Get current cache state (useful for debugging)
    getCache() {
      return {
        hasData: !!cache.data,
        age: cache.timestamp ? Date.now() - cache.timestamp : null,
        isStale: cache.timestamp ? Date.now() - cache.timestamp > ttl : true
      };
    }
  };
}
