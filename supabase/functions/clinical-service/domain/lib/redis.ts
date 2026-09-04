import { Redis } from "npm:@upstash/redis@1.38.3";

import { recordCacheMetric } from "./cache/policy.ts";

// Singleton Upstash Redis client with graceful fallback.
function createRedisClient(): Redis | null {
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token) {
    if (Deno.env.get("NODE_ENV") === "development") {
      console.warn(
        "[Upstash Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN missing in environment.",
      );
    }
    return null;
  }

  try {
    return new Redis({ url, token });
  } catch {
    console.error(JSON.stringify({ event: "redis_init_failed" }));
    return null;
  }
}

export const redis = createRedisClient();

/**
 * Safely reads a cached item from Upstash Redis.
 * Returns null if key is not found or if Redis fails.
 */
export async function redisGet<T>(
  key: string,
  scope = "unspecified",
): Promise<T | null> {
  if (!redis) return null;
  const startedAt = performance.now();
  try {
    const data = await redis.get<T>(key);
    recordCacheMetric({
      durationMs: performance.now() - startedAt,
      hit: data !== null,
      operation: "get",
      scope,
    });
    return data;
  } catch (error) {
    recordCacheMetric({
      durationMs: performance.now() - startedAt,
      hit: false,
      operation: "get",
      scope,
    });
    console.warn(
      JSON.stringify({
        code: error instanceof Error ? error.name : "REDIS_GET_FAILED",
        event: "redis_get_failed",
        scope,
      }),
    );
    return null;
  }
}

/**
 * Safely writes a cached item to Upstash Redis with a TTL in seconds.
 */
export async function redisSet<T>(
  key: string,
  value: T,
  ttlSeconds = 120,
  scope = "unspecified",
): Promise<void> {
  if (!redis) return;
  const startedAt = performance.now();
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    console.warn(
      JSON.stringify({
        code: error instanceof Error ? error.name : "REDIS_SET_FAILED",
        event: "redis_set_failed",
        scope,
      }),
    );
  } finally {
    recordCacheMetric({
      durationMs: performance.now() - startedAt,
      operation: "set",
      scope,
    });
  }
}

/**
 * Safely deletes one or more keys from Upstash Redis.
 */
export async function redisDel(
  keys: string | string[],
  scope = "unspecified",
): Promise<void> {
  if (!redis) return;
  const startedAt = performance.now();
  try {
    const targetKeys = Array.isArray(keys) ? keys : [keys];
    if (targetKeys.length === 0) return;
    await redis.del(...targetKeys);
  } catch (error) {
    console.warn(
      JSON.stringify({
        code: error instanceof Error ? error.name : "REDIS_DELETE_FAILED",
        event: "redis_delete_failed",
        scope,
      }),
    );
  } finally {
    recordCacheMetric({
      durationMs: performance.now() - startedAt,
      operation: "delete",
      scope,
    });
  }
}
