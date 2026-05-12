export interface FixedWindowLimiterOptions {
  max: number
  windowMs: number
  now?: () => number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

interface Bucket {
  count: number
  resetAt: number
}

export function createFixedWindowLimiter(options: FixedWindowLimiterOptions) {
  const buckets = new Map<string, Bucket>()
  const now = options.now ?? (() => Date.now())
  let nextCleanupAt = 0

  function pruneExpiredBuckets(current: number) {
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= current) {
        buckets.delete(key)
      }
    })
  }

  return {
    check(key: string): RateLimitResult {
      const current = now()
      if (current >= nextCleanupAt) {
        pruneExpiredBuckets(current)
        nextCleanupAt = current + options.windowMs
      }

      const existing = buckets.get(key)
      const bucket =
        existing && existing.resetAt > current
          ? existing
          : { count: 0, resetAt: current + options.windowMs }

      bucket.count += 1
      buckets.set(key, bucket)

      const remaining = Math.max(options.max - bucket.count, 0)

      return {
        allowed: bucket.count <= options.max,
        remaining,
        resetAt: bucket.resetAt,
        limit: options.max,
      }
    },
    size() {
      return buckets.size
    },
  }
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  }
}
