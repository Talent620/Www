/**
 * Fixed-window, in-memory rate limiter.
 *
 * Protects expensive/public endpoints (generation, key verification, lead
 * capture) from abuse and runaway cost without an external dependency. Keyed by
 * client + bucket; the clock is injectable so the behavior is unit-testable.
 *
 * For a single-instance deployment this is sufficient. Horizontally scaled
 * deployments should back this with Redis (same interface).
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Milliseconds until the current window resets. */
  resetMs: number;
}

interface Window {
  count: number;
  start: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, Window>();
  private lastSweep = 0;

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Record a hit for `key` and report whether it is within `limit` per `windowMs`. */
  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const t = this.now();
    this.maybeSweep(t, windowMs);

    const existing = this.hits.get(key);
    if (!existing || t - existing.start >= windowMs) {
      this.hits.set(key, { count: 1, start: t });
      return { allowed: true, limit, remaining: limit - 1, resetMs: windowMs };
    }

    existing.count += 1;
    const resetMs = windowMs - (t - existing.start);
    if (existing.count > limit) {
      return { allowed: false, limit, remaining: 0, resetMs };
    }
    return { allowed: true, limit, remaining: limit - existing.count, resetMs };
  }

  /** Drop expired windows periodically so the map can't grow without bound. */
  private maybeSweep(t: number, windowMs: number): void {
    if (t - this.lastSweep < windowMs) return;
    this.lastSweep = t;
    for (const [key, win] of this.hits) {
      if (t - win.start >= windowMs) this.hits.delete(key);
    }
  }
}

/** Process-wide limiter shared across route handlers. */
export const limiter = new RateLimiter();

/** Best-effort client identifier from proxy headers, falling back to a constant. */
export function clientKey(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'anonymous';
}

/**
 * Enforce a limit for (bucket, client). Returns a 429 `Response` when exceeded,
 * or `null` when the request may proceed.
 */
export function enforceRateLimit(
  req: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): Response | null {
  const result = limiter.check(`${bucket}:${clientKey(req)}`, limit, windowMs);
  if (result.allowed) return null;
  const retryAfter = Math.ceil(result.resetMs / 1000);
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please slow down.', retryAfter }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}
