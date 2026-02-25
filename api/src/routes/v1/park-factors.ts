import { Hono } from 'hono';
import type { Env, Tier } from '../../shared/types';
import { buildMeta, cachedJson, kvGet, kvPut } from '../../shared/helpers';
import { serverError } from '../../shared/errors';

const SEASON = 2026;

const parkFactors = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

/**
 * GET /v1/park-factors
 * All park factors. Free: Power 5 only. Pro: all D1.
 */
parkFactors.get('/', async (c) => {
  const tier = c.get('tier') || 'free';
  const conference = c.req.query('conf') || '';

  const cacheKey = `parks:${conference || 'all'}:${tier}`;
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true, tier) }, 200, 600, { 'X-Cache': 'HIT' });
  }

  try {
    let query = `
      SELECT team, team_id, venue_name, conference, season,
             runs_factor, hits_factor, hr_factor, bb_factor, so_factor,
             sample_games, methodology_note
      FROM cbb_park_factors
      WHERE season = ?
    `;
    const binds: (string | number)[] = [SEASON];

    if (conference) {
      query += ' AND conference = ?';
      binds.push(conference);
    }

    query += ' ORDER BY runs_factor DESC';

    const { results } = await c.env.DB.prepare(query).bind(...binds).all();

    // Free: top 5
    const output = tier === 'free' ? results.slice(0, 5) : results;

    await kvPut(c.env.CACHE, cacheKey, output, 600);
    return cachedJson({
      data: output,
      total: results.length,
      meta: buildMeta('bsi-cbb-api', false, tier),
    }, 200, 600, { 'X-Cache': 'MISS' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

export default parkFactors;
