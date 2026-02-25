import type { Tier } from '../shared/types';
import { stripProFields } from '../shared/helpers';

/**
 * Apply tier gating to response data.
 * Free tier: strip pro fields, limit rows to 10.
 * Pro/Enterprise: full data, up to 100 rows.
 */
export function applyTierGating<T extends Record<string, unknown>>(
  rows: T[],
  tier: Tier,
): T[] {
  if (tier === 'pro' || tier === 'enterprise') {
    return rows.slice(0, 100);
  }

  // Free tier: 10 rows, pro fields stripped
  return rows.slice(0, 10).map(r => stripProFields(r)) as T[];
}

/** Get max leaderboard rows for a tier. */
export function maxRows(tier: Tier): number {
  if (tier === 'enterprise') return 1000;
  if (tier === 'pro') return 100;
  return 10;
}
