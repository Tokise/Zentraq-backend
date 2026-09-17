export const CACHE_VERSION = "v1";

export const cachePolicy = {
  announcements: {
    key: (audience: string) =>
      `${CACHE_VERSION}:announcements:audience:${audience}`,
    ttlSeconds: 120,
  },
  catalogs: {
    medicines: `${CACHE_VERSION}:catalog:medicines`,
    ttlSeconds: 5 * 60,
    visitReasons: `${CACHE_VERSION}:catalog:visit-reasons`,
  },
  rateLimits: {
    key: (scope: string, identifierHash: string) =>
      `${CACHE_VERSION}:rate-limit:${scope}:${identifierHash}`,
  },
} as const;

export type CacheMetricOperation = "delete" | "get" | "set";

// Emits non-sensitive cache timing data for production performance analysis.
export function recordCacheMetric(input: {
  durationMs: number;
  hit?: boolean;
  operation: CacheMetricOperation;
  scope: string;
}): void {
  console.info(
    JSON.stringify({
      durationMs: Math.round(input.durationMs),
      event: "cache_operation",
      hit: input.hit,
      operation: input.operation,
      scope: input.scope,
    }),
  );
}
