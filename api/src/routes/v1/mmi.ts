import { Hono } from 'hono';
import type { Env, Tier } from '../../shared/types';
import { buildMeta, cachedJson, kvGet, kvPut } from '../../shared/helpers';
import { notFound, serverError } from '../../shared/errors';

const mmi = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

/**
 * GET /v1/mmi/game/:id
 * Momentum timeline for a specific game. Pro tier.
 */
mmi.get('/game/:id', async (c) => {
  const gameId = c.req.param('id');

  const cacheKey = `mmi:game:${gameId}`;
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true, 'pro') }, 200, 300, { 'X-Cache': 'HIT' });
  }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM mmi_snapshots WHERE game_id = ? ORDER BY snapshot_order ASC
    `).bind(gameId).all();

    if (results.length === 0) return notFound('MMI data for game', gameId);

    await kvPut(c.env.CACHE, cacheKey, results, 300);
    return cachedJson({
      data: { game_id: gameId, snapshots: results },
      meta: buildMeta('bsi-cbb-api', false, 'pro'),
    }, 200, 300, { 'X-Cache': 'MISS' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

/**
 * GET /v1/mmi/trending
 * Most exciting recent games by MMI volatility. Pro tier.
 */
mmi.get('/trending', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10) || 10, 50);

  const cacheKey = `mmi:trending:${limit}`;
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true, 'pro') }, 200, 60, { 'X-Cache': 'HIT' });
  }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT game_id, max_mmi, min_mmi, avg_mmi, volatility,
             lead_changes, max_swing, excitement_rating
      FROM mmi_game_summaries
      ORDER BY volatility DESC
      LIMIT ?
    `).bind(limit).all();

    await kvPut(c.env.CACHE, cacheKey, results, 60);
    return cachedJson({
      data: results,
      meta: buildMeta('bsi-cbb-api', false, 'pro'),
    }, 200, 60, { 'X-Cache': 'MISS' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

export default mmi;
