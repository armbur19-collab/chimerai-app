// @chimerai component=RateLimiter version=1.1
/**
 * Rate Limiter with API-Key support
 *
 * Supports:
 * - In-memory fallback (single-instance, dev)
 * - Upstash Redis (multi-instance, production)
 * - Per-user rate limits (session auth)
 * - Per-API-key rate limits (widget/external auth)
 */

// ── Rate Limit Tiers ─────────────────────────────────────────────
export const RATE_LIMITS = {
  session: { maxRequests: 100, windowMs: 60_000 },   // 100 req/min for logged-in users
  apiKey:  { maxRequests: 60,  windowMs: 60_000 },   // 60 req/min for API keys
  global:  { maxRequests: 200, windowMs: 60_000 },   // 200 req/min global fallback
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;       // Unix timestamp (ms)
  retryAfterMs: number;  // 0 if allowed
}

// ── In-Memory Store ──────────────────────────────────────────────
const store = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt < now) store.delete(key);
    }
  }, 60_000);
}

function checkInMemory(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let record = store.get(key);

  if (!record || record.resetAt <= now) {
    record = { count: 1, resetAt: now + windowMs };
    store.set(key, record);
    return { allowed: true, remaining: limit - 1, resetAt: record.resetAt, retryAfterMs: 0 };
  }

  record.count++;
  store.set(key, record);

  if (record.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      retryAfterMs: record.resetAt - now,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - record.count),
    resetAt: record.resetAt,
    retryAfterMs: 0,
  };
}

// ── Upstash Redis (optional) ─────────────────────────────────────
let upstashLimiter: any = null;
let upstashInitDone = false;

async function initUpstash() {
  if (upstashInitDone) return;
  upstashInitDone = true;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      // @ts-ignore — optional dependency, falls back to in-memory if not installed
      const { Ratelimit } = await import('@upstash/ratelimit');
      // @ts-ignore — optional dependency
      const { Redis } = await import('@upstash/redis');

      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      upstashLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, '1 m'),
        analytics: false,
        prefix: 'chimerai:rl',
      });
    } catch {
      // @upstash packages not installed — use in-memory
    }
  }
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Check rate limit for a session-based user.
 */
export async function checkSessionRateLimit(userId: string): Promise<RateLimitResult> {
  return checkRateLimit('session:' + userId, RATE_LIMITS.session);
}

/**
 * Check rate limit for an API-key-based request.
 */
export async function checkApiKeyRateLimit(apiKeyId: string): Promise<RateLimitResult> {
  return checkRateLimit('apikey:' + apiKeyId, RATE_LIMITS.apiKey);
}

/**
 * Generic rate limit check. Tries Upstash first, falls back to in-memory.
 */
export async function checkRateLimit(
  identifier: string,
  config: { maxRequests: number; windowMs: number } = RATE_LIMITS.global
): Promise<RateLimitResult> {
  await initUpstash();

  // Try Upstash first
  if (upstashLimiter) {
    try {
      const result = await upstashLimiter.limit(identifier);
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
        retryAfterMs: result.success ? 0 : Math.max(0, result.reset - Date.now()),
      };
    } catch {
      // Upstash failed — fall through to in-memory
    }
  }

  // In-memory fallback
  return checkInMemory(identifier, config.maxRequests, config.windowMs);
}

/**
 * Adds rate limit headers to a Response.
 */
export function withRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
  if (!result.allowed) {
    headers.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ── Startup Warning ──────────────────────────────────────────────
if (process.env.NODE_ENV === 'production' && !process.env.UPSTASH_REDIS_REST_URL) {
  console.warn(
    '⚠️  UPSTASH_REDIS_REST_URL not configured. Rate-limiting uses in-memory fallback. ' +
    'This works for single-instance deployments but NOT for serverless (Vercel, AWS Lambda). ' +
    'For serverless: configure Upstash Redis → https://upstash.com'
  );
}
