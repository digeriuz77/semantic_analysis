/**
 * Minimal in-memory sliding-window rate limiter for the LLM-orchestrating
 * routes. Each POST to /api/analyze-ensemble can trigger up to 24 LLM calls
 * (6 seeds x 4 chunks) and /api/compare-models multiplies that per spec, so an
 * accidental loop or a hostile client can amplify cost. Per-process only —
 * appropriate for a local single-user tool; use a shared store if deployed.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the oldest timestamp leaves the window (retry hint). */
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_KEYS) {
      // Hard cap to bound memory; clearing is fine for a best-effort limiter.
      buckets.clear();
    }
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    return { allowed: false, retryAfterMs: Math.max(1, windowMs - (now - oldest)) };
  }
  bucket.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

/** Best-effort client key: last hop in x-forwarded-for, else "local". */
export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}

/** Periodically drop stale buckets so the map does not grow unboundedly. */
if (typeof setInterval === "function") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.timestamps.length === 0 || now - bucket.timestamps[bucket.timestamps.length - 1] > 3_600_000) {
        buckets.delete(key);
      }
    }
  }, 600_000);
  // Do not hold the process open for the sweep timer.
  (timer as unknown as { unref?: () => void }).unref?.();
}
