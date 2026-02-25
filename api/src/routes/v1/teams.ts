import { Hono } from 'hono';
import type { Env, Tier } from '../../shared/types';
import { buildMeta, cachedJson, kvGet, kvPut, stripProFields } from '../../shared/helpers';
import { notFound, serverError } from '../../shared/errors';

const SEASON = 2026;

const teams = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

/**
 * GET /v1/teams
 * List all D1 teams.
 */
teams.get('/', async (c) => {
  const cacheKey = 'teams:all';
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true) }, 200, 600, { 'X-Cache': 'HIT' });
  }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT DISTINCT team, team_id, conference
      FROM cbb_batting_advanced
      WHERE season = ?
      ORDER BY team ASC
    `).bind(SEASON).all();

    await kvPut(c.env.CACHE, cacheKey, results, 600);
    return cachedJson({
      data: results,
      total: results.length,
      meta: buildMeta('bsi-cbb-api', false),
    }, 200, 600, { 'X-Cache': 'MISS' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

/**
 * GET /v1/teams/:id
 * Team detail — roster with sabermetrics for pro tier.
 */
teams.get('/:id', async (c) => {
  const teamId = c.req.param('id');
  const tier = c.get('tier') || 'free';

  const cacheKey = `team:${teamId}:${tier}`;
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true, tier) }, 200, 300, { 'X-Cache': 'HIT' });
  }

  try {
    const batters = await c.env.DB.prepare(`
      SELECT * FROM cbb_batting_advanced WHERE team_id = ? AND season = ? ORDER BY woba DESC
    `).bind(teamId, SEASON).all();

    const pitchers = await c.env.DB.prepare(`
      SELECT * FROM cbb_pitching_advanced WHERE team_id = ? AND season = ? ORDER BY fip ASC
    `).bind(teamId, SEASON).all();

    if (batters.results.length === 0 && pitchers.results.length === 0) {
      return notFound('Team', teamId);
    }

    let batterData = batters.results as Record<string, unknown>[];
    let pitcherData = pitchers.results as Record<string, unknown>[];
    if (tier === 'free') {
      batterData = batterData.map(stripProFields);
      pitcherData = pitcherData.map(stripProFields);
    }

    const team = {
      team_id: teamId,
      team: batterData[0]?.team || pitcherData[0]?.team || teamId,
      conference: batterData[0]?.conference || pitcherData[0]?.conference || '',
      batters: batterData,
      pitchers: pitcherData,
    };

    await kvPut(c.env.CACHE, cacheKey, team, 300);
    return cachedJson({ data: team, meta: buildMeta('bsi-cbb-api', false, tier) }, 200, 300, { 'X-Cache': 'MISS' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

export default teams;
