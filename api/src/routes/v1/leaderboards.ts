import { Hono } from 'hono';
import type { Env, Tier } from '../../shared/types';
import { buildMeta, cachedJson, kvGet, kvPut, stripProFields } from '../../shared/helpers';
import { badRequest, serverError } from '../../shared/errors';
import { maxRows } from '../../middleware/tier-gate';

const SEASON = 2026;

const BATTING_METRICS = new Set([
  'avg', 'obp', 'slg', 'ops', 'k_pct', 'bb_pct', 'iso', 'babip',
  'woba', 'wrc_plus', 'ops_plus', 'pa', 'hr',
]);

const PITCHING_METRICS = new Set([
  'era', 'whip', 'k_9', 'bb_9', 'hr_9', 'fip', 'x_fip',
  'era_minus', 'k_bb', 'lob_pct', 'ip', 'so',
]);

const leaderboards = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

/**
 * GET /v1/leaderboards/batting
 * Sort by any batting metric with optional conference/position filters.
 */
leaderboards.get('/batting', async (c) => {
  const tier = c.get('tier') || 'free';
  const metric = c.req.query('metric') || 'woba';
  const conference = c.req.query('conf') || '';
  const position = c.req.query('pos') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10) || 25, maxRows(tier));
  const sortDir = c.req.query('sort') === 'asc' ? 'ASC' : 'DESC';

  const safeMetric = BATTING_METRICS.has(metric) ? metric : 'woba';

  const cacheKey = `lb:bat:${safeMetric}:${conference || 'all'}:${position || 'all'}:${limit}:${sortDir}:${tier}`;
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true, tier) }, 200, 300, { 'X-Cache': 'HIT' });
  }

  try {
    let query = `
      SELECT player_id, player_name, team, conference, position, class_year,
             g, ab, pa, h, hr, bb, so,
             avg, obp, slg, ops, k_pct, bb_pct, iso, babip,
             woba, wrc_plus, ops_plus, e_ba, e_slg, e_woba
      FROM cbb_batting_advanced
      WHERE season = ?
    `;
    const binds: (string | number)[] = [SEASON];

    if (conference) { query += ' AND conference = ?'; binds.push(conference); }
    if (position) { query += ' AND position = ?'; binds.push(position); }

    query += ` ORDER BY ${safeMetric} ${sortDir} LIMIT ?`;
    binds.push(limit);

    const { results } = await c.env.DB.prepare(query).bind(...binds).all();

    let output = results as Record<string, unknown>[];
    if (tier === 'free') output = output.map(stripProFields);

    await kvPut(c.env.CACHE, cacheKey, output, 300);
    return cachedJson({
      data: output,
      total: results.length,
      meta: buildMeta('bsi-cbb-api', false, tier),
    }, 200, 300, { 'X-Cache': 'MISS' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

/**
 * GET /v1/leaderboards/pitching
 * Sort by any pitching metric.
 */
leaderboards.get('/pitching', async (c) => {
  const tier = c.get('tier') || 'free';
  const metric = c.req.query('metric') || 'fip';
  const conference = c.req.query('conf') || '';
  const position = c.req.query('pos') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10) || 25, maxRows(tier));
  const sortDir = c.req.query('sort') === 'desc' ? 'DESC' : 'ASC';

  const safeMetric = PITCHING_METRICS.has(metric) ? metric : 'fip';

  const cacheKey = `lb:pitch:${safeMetric}:${conference || 'all'}:${position || 'all'}:${limit}:${sortDir}:${tier}`;
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true, tier) }, 200, 300, { 'X-Cache': 'HIT' });
  }

  try {
    let query = `
      SELECT player_id, player_name, team, conference, position, class_year,
             g, gs, w, l, sv, ip, h, er, bb, hbp, so, era, whip,
             k_9, bb_9, hr_9, fip, x_fip, era_minus, k_bb, lob_pct, babip
      FROM cbb_pitching_advanced
      WHERE season = ?
    `;
    const binds: (string | number)[] = [SEASON];

    if (conference) { query += ' AND conference = ?'; binds.push(conference); }
    if (position) { query += ' AND position = ?'; binds.push(position); }

    query += ` ORDER BY ${safeMetric} ${sortDir} LIMIT ?`;
    binds.push(limit);

    const { results } = await c.env.DB.prepare(query).bind(...binds).all();

    let output = results as Record<string, unknown>[];
    if (tier === 'free') output = output.map(stripProFields);

    await kvPut(c.env.CACHE, cacheKey, output, 300);
    return cachedJson({
      data: output,
      total: results.length,
      meta: buildMeta('bsi-cbb-api', false, tier),
    }, 200, 300, { 'X-Cache': 'MISS' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

export default leaderboards;
