import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { redis } from "../../redis";

/**
 * Small read-through cache for dashboard analytics.
 *
 * Keys are always namespaced by `storeId` (built by the caller via cacheKey) so
 * one store can never read another's cached result. TTL is fixed at
 * DASHBOARD_CACHE_TTL_SECONDS (default 300s / 5 min). Fails OPEN: any Redis
 * error falls back to computing fresh data rather than erroring the request.
 *
 * This helper only runs inside authenticated, permission-checked handlers, so a
 * permission failure (403) short-circuits before any cache read/write — failures
 * are never cached.
 */

const TTL_SECONDS = env.DASHBOARD_CACHE_TTL_SECONDS;

/**
 * Builds a tenant-scoped cache key. The storeId is always the first segment
 * after the namespace so cross-store reads are impossible by construction.
 */
export function cacheKey(
  storeId: string,
  endpoint: string,
  ...parts: (string | number)[]
): string {
  return ["dashboard", storeId, endpoint, ...parts].join(":");
}

/**
 * Returns the cached value for `key`, or computes it with `producer`, caches it
 * (when TTL > 0), and returns it. When `refresh` is true the cache read is
 * skipped and the value is recomputed and rewritten.
 */
export async function getCached<T>(
  key: string,
  refresh: boolean,
  producer: () => Promise<T>,
): Promise<T> {
  if (!refresh && TTL_SECONDS > 0) {
    try {
      const hit = await redis.get(key);
      if (hit !== null) {
        return JSON.parse(hit) as T;
      }
    } catch (err) {
      logger.warn({ err, key }, "Dashboard cache read failed; computing fresh");
    }
  }

  const data = await producer();

  if (TTL_SECONDS > 0) {
    try {
      await redis.set(key, JSON.stringify(data), "EX", TTL_SECONDS);
    } catch (err) {
      logger.warn({ err, key }, "Dashboard cache write failed");
    }
  }

  return data;
}
