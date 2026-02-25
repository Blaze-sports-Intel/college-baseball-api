import { Hono } from 'hono';
import type { Env, Tier } from '../../shared/types';
import { buildMeta, cachedJson, kvGet, kvPut } from '../../shared/helpers';
import { notFound, serverError } from '../../shared/errors';

const SEASON = 2026;

const conferences = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

/**
 * GET /v1/conferences
 * List all conferences with basic info.
 */
conferences.get('/', async (c) => {
  const tier = c.get('tier') || 'free';

  const cacheKey = `conf:all:${tier}`;
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true, tier) }, 200, 600, { 'X-Cache': 'HIT' });
  }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT conference, season, strength_index, run_environment,
             avg_era, avg_ops, avg_woba, inter_conf_win_pct, rpi_avg, is_power
      FROM cbb_conference_strength
      WHERE season = ?
      ORDER BY strength_index DESC
    `).bind(SEASON).all();

    // Free: top 5 only
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

/**
 * GET /v1/conferences/:name
 * Conference detail with strength index breakdown. Pro tier.
 */
conferences.get('/:name', async (c) => {
  const name = decodeURIComponent(c.req.param('name'));
  const tier = c.get('tier') || 'free';

  try {
    const conf = await c.env.DB.prepare(`
      SELECT * FROM cbb_conference_strength WHERE conference = ? AND season = ?
    `).bind(name, SEASON).first();

    if (!conf) return notFound('Conference', name);

    return cachedJson({
      data: conf,
      meta: buildMeta('bsi-cbb-api', false, tier),
    }, 200, 600);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

export default conferences;
