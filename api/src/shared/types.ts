/** Cloudflare Worker environment bindings. */
export interface Env {
  // D1
  DB: D1Database;

  // KV
  CACHE: KVNamespace;
  API_KEYS: KVNamespace;

  // Env vars
  ENVIRONMENT: string;
  API_VERSION: string;
}

/** Stored API key data. */
export interface ApiKeyData {
  tier: 'free' | 'pro' | 'enterprise';
  email: string;
  rateLimit: number;
  expires: number;
  createdAt: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

/** Standard API response envelope. */
export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
  pagination?: Pagination;
}

export interface ApiMeta {
  source: string;
  fetched_at: string;
  timezone: 'America/Chicago';
  tier?: string;
  cache_hit?: boolean;
}

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
}

/** Tier levels for field gating. */
export type Tier = 'free' | 'pro' | 'enterprise';

/** Rate limit info for response headers. */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}
