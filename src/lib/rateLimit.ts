/**
 * Simple in-memory rate limiter.
 * Limits each IP to `maxRequests` per `windowMs` milliseconds.
 * Resets automatically via a cleanup interval.
 * 
 * ⚠️ LIMITATION & FUTURE UPGRADE:
 * As documented in SYSTEM_DESIGN.md, this in-memory rate limiter resets on every Vercel
 * serverless function cold start. For production-grade rate limiting across distributed 
 * serverless instances, this should be migrated to a centralized store like Upstash Redis
 * (using `@upstash/redis` or `@vercel/kv`).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function checkRateLimit(
  ip: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  entry.count += 1;
  const allowed = entry.count <= config.maxRequests;
  return { allowed, remaining: Math.max(0, config.maxRequests - entry.count), resetAt: entry.resetAt };
}

/** Extract IP from Next.js request headers */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
