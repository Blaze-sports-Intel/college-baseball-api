import { Hono } from 'hono';
import type { Env, Tier } from '../../shared/types';
import { buildMeta, cachedJson, kvGet, kvPut } from '../../shared/helpers';
import { notFound, serverError } from '../../shared/errors';

const SEASON = 2026;

const havf = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

/**
 * GET /v1/havf/leaderboard
 * HAV-F composite leaderboard. Pro tier.
 */
havf.get('/leaderboard', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10) || 25, 100);
  const conference = c.req.query('conf') || '';

  const cacheKey = `havf:lb:${conference || 'all'}:${limit}`;
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true, 'pro') }, 200, 300, { 'X-Cache': 'HIT' });
  }

  try {
    let query = `
      SELECT player_id, player_name, team, conference, season,
             h_score, a_score, v_score, f_score, havf_composite
      FROM havf_scores
      WHERE season = ?
    `;
    const binds: (string | number)[] = [SEASON];

    if (conference) {
      query += ' AND conference = ?';
      binds.push(conference);
    }

    query += ' ORDER BY havf_composite DESC LIMIT ?';
    binds.push(limit);

    const { results } = await c.env.DB.prepare(query).bind(...binds).all();

    await kvPut(c.env.CACHE, cacheKey, results, 300);
    return cachedJson({
      data: results,
      total: results.length,
      meta: buildMeta('bsi-cbb-api', false, 'pro'),
    }, 200, 300, { 'X-Cache': 'MISS' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

/**
 * GET /v1/havf/player/:id
 * HAV-F component breakdown for a single player. Pro tier.
 */
havf.get('/player/:id', async (c) => {
  const playerId = c.req.param('id');

  try {
    const result = await c.env.DB.prepare(`
      SELECT * FROM havf_scores WHERE player_id = ? AND season = ?
    `).bind(playerId, SEASON).first();

    if (!result) return notFound('HAV-F data', playerId);

    return cachedJson({
      data: result,
      meta: buildMeta('bsi-cbb-api', false, 'pro'),
    }, 200, 300);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

export default havf;
