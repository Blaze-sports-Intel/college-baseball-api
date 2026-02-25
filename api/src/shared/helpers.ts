import type { ApiMeta, RateLimitInfo } from './types';

/** Build standard API response metadata. */
export function buildMeta(source: string, cacheHit: boolean = false, tier?: string): ApiMeta {
  return {
    source,
    fetched_at: new Date().toISOString(),
    timezone: 'America/Chicago',
    ...(tier && { tier }),
    cache_hit: cacheHit,
  };
}

/** JSON response with standard headers. */
export function json(data: unknown, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...headers,
    },
  });
}

/** JSON response with Cache-Control. */
export function cachedJson(data: unknown, status: number, maxAge: number, headers: Record<string, string> = {}): Response {
  return json(data, status, {
    'Cache-Control': `public, max-age=${maxAge}`,
    ...headers,
  });
}

/** Read from KV with JSON parsing. */
export async function kvGet<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key, 'text');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write to KV with TTL. */
export async function kvPut(kv: KVNamespace, key: string, data: unknown, ttl: number): Promise<void> {
  await kv.put(key, JSON.stringify(data), { expirationTtl: ttl });
}

/** Build rate limit response headers. */
export function rateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(info.limit),
    'X-RateLimit-Remaining': String(info.remaining),
    'X-RateLimit-Reset': String(info.reset),
  };
}

/** Pro-tier field keys that get stripped for free tier. */
const PRO_FIELDS = new Set([
  'woba', 'wrc_plus', 'ops_plus', 'e_ba', 'e_slg', 'e_woba',
  'fip', 'x_fip', 'era_minus', 'k_bb', 'lob_pct',
  'havf_composite', 'h_score', 'a_score', 'v_score', 'f_score',
]);

/** Strip pro-tier fields from a row for free-tier responses. */
export function stripProFields(row: Record<string, unknown>): Record<string, unknown> {
  const filtered = { ...row };
  for (const key of PRO_FIELDS) {
    if (key in filtered) {
      filtered[key] = null;
    }
  }
  filtered._tier_gated = true;
  return filtered;
}
