import type { Context, Next } from 'hono';
import type { Env, ApiKeyData, Tier } from '../shared/types';
import { unauthorized, forbidden, paymentRequired } from '../shared/errors';

/**
 * Auth middleware — validates X-API-Key header against KV.
 * Sets `tier` variable on the context for downstream handlers.
 *
 * Free tier: no key required (anonymous gets 'free' tier).
 * Pro/Enterprise: key required, validated against CBB_API_KEYS KV.
 */
export async function auth(c: Context<{ Bindings: Env; Variables: { tier: Tier; apiKey?: string } }>, next: Next) {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    // Anonymous access = free tier
    c.set('tier', 'free');
    await next();
    return;
  }

  try {
    const raw = await c.env.API_KEYS.get(`key:${apiKey}`);
    if (!raw) {
      return forbidden('Invalid API key');
    }

    const keyData: ApiKeyData = JSON.parse(raw);

    if (Date.now() > keyData.expires) {
      return paymentRequired('API key expired');
    }

    c.set('tier', keyData.tier);
    c.set('apiKey', apiKey);
  } catch {
    return forbidden('Invalid API key');
  }

  await next();
}

/**
 * Middleware factory: require a minimum tier for a route.
 * Place after `auth` middleware.
 */
export function requireTier(minTier: 'pro' | 'enterprise') {
  const tierOrder: Record<Tier, number> = { free: 0, pro: 1, enterprise: 2 };

  return async (c: Context<{ Bindings: Env; Variables: { tier: Tier } }>, next: Next) => {
    const currentTier = c.get('tier') || 'free';
    if (tierOrder[currentTier] < tierOrder[minTier]) {
      return paymentRequired(`This endpoint requires ${minTier} tier or higher`);
    }
    await next();
  };
}
