/**
 * Sliding Window In-Memory Rate Limiter.
 * Works across Server Actions and API endpoints in Node/Edge environments.
 */

interface RateLimitRecord {
  timestamps: number[]
}

const storage = new Map<string, RateLimitRecord>()

// Periodic cleanup every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of storage.entries()) {
      const validTimestamps = record.timestamps.filter((ts) => now - ts < 3600000)
      if (validTimestamps.length === 0) {
        storage.delete(key)
      } else {
        record.timestamps = validTimestamps
      }
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetInSeconds: number
}

/**
 * Checks whether a given key has exceeded the rate limit.
 * @param key Identifier (e.g. `login:${ip}` or `login:${email}`)
 * @param limit Max allowed hits within the window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const record = storage.get(key) || { timestamps: [] }

  // Filter timestamps within the current window
  const timestampsInWindow = record.timestamps.filter((ts) => now - ts < windowMs)

  if (timestampsInWindow.length >= limit) {
    const oldest = timestampsInWindow[0]
    const resetInSeconds = Math.ceil((oldest + windowMs - now) / 1000)
    return {
      success: false,
      limit,
      remaining: 0,
      resetInSeconds: resetInSeconds > 0 ? resetInSeconds : 1,
    }
  }

  // Record this request
  timestampsInWindow.push(now)
  storage.set(key, { timestamps: timestampsInWindow })

  return {
    success: true,
    limit,
    remaining: limit - timestampsInWindow.length,
    resetInSeconds: Math.ceil(windowMs / 1000),
  }
}
