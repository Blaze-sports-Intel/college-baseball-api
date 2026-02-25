import type { Context, Next } from 'hono';
import type { Env, Tier } from '../shared/types';
import { rateLimited } from '../shared/errors';
import { rateLimitHeaders } from '../shared/helpers';

const WINDOW_MS = 60_000; // 1 minute

/** Requests per minute by tier. */
const TIER_LIMITS: Record<Tier, number> = {
  free: 30,
  pro: 120,
  enterprise: 600,
};

/**
 * In-memory rate limiting per IP (or API key for authenticated requests).
 * Falls back to KV-based rate limiting if needed for multi-worker scenarios,
 * but in-memory is sufficient for a single-worker deployment.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let cleanupCounter = 0;

function maybeCleanup(): void {
  if (++cleanupCounter < 500) return;
  cleanupCounter = 0;
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}

export async function rateLimit(c: Context<{ Bindings: Env; Variables: { tier: Tier; apiKey?: string } }>, next: Next) {
  maybeCleanup();

  const tier = c.get('tier') || 'free';
  const limit = TIER_LIMITS[tier];

  // Use API key as identifier for authenticated requests, IP for anonymous
  const identifier = c.get('apiKey') || c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const key = `rl:${identifier}`;

  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + WINDOW_MS;
    rateLimitMap.set(key, { count: 1, resetAt });

    const headers = rateLimitHeaders({ limit, remaining: limit - 1, reset: Math.ceil(resetAt / 1000) });
    for (const [k, v] of Object.entries(headers)) {
      c.res.headers.set(k, v);
    }
    await next();
    return;
  }

  entry.count++;

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return rateLimited(retryAfter);
  }

  const remaining = Math.max(0, limit - entry.count);
  const headers = rateLimitHeaders({ limit, remaining, reset: Math.ceil(entry.resetAt / 1000) });

  await next();

  for (const [k, v] of Object.entries(headers)) {
    c.res.headers.set(k, v);
  }
}
