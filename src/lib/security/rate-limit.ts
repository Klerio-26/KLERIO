/**
 * Limiteur de débit en mémoire.
 * Suffisant pour une instance unique / le développement.
 * En production multi-instances : remplacer par Redis (même interface).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      ok: true,
      remaining: limit - 1,
      resetAt: new Date(now + windowMs),
      retryAfterSeconds: Math.ceil(windowMs / 1000)
    };
  }
  existing.count += 1;
  const ok = existing.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - existing.count),
    resetAt: new Date(existing.resetAt),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  };
}

/** Nettoyage opportuniste pour éviter une fuite mémoire. */
export function cleanupRateLimits(now = Date.now()): void {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
