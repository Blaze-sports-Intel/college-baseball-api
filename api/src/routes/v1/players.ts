import { Hono } from 'hono';
import type { Env, Tier } from '../../shared/types';
import { buildMeta, cachedJson, kvGet, kvPut, stripProFields } from '../../shared/helpers';
import { notFound, serverError } from '../../shared/errors';
import { maxRows } from '../../middleware/tier-gate';

const SEASON = 2026;

const players = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

/**
 * GET /v1/players
 * List players with optional filters.
 */
players.get('/', async (c) => {
  const tier = c.get('tier') || 'free';
  const team = c.req.query('team') || '';
  const conf = c.req.query('conf') || '';
  const pos = c.req.query('pos') || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10) || 25, maxRows(tier));
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0;

  const cacheKey = `players:${team}:${conf}:${pos}:${limit}:${offset}:${tier}`;
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true, tier) }, 200, 60, { 'X-Cache': 'HIT' });
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

    if (team) { query += ' AND team = ?'; binds.push(team); }
    if (conf) { query += ' AND conference = ?'; binds.push(conf); }
    if (pos) { query += ' AND position = ?'; binds.push(pos); }

    query += ' ORDER BY woba DESC LIMIT ? OFFSET ?';
    binds.push(limit, offset);

    const { results } = await c.env.DB.prepare(query).bind(...binds).all();

    let output = results as Record<string, unknown>[];
    if (tier === 'free') {
      output = output.map(stripProFields);
    }

    await kvPut(c.env.CACHE, cacheKey, output, 300);
    return cachedJson({
      data: output,
      meta: buildMeta('bsi-cbb-api', false, tier),
      pagination: { limit, offset, total: results.length, has_more: results.length === limit },
    }, 200, 60, { 'X-Cache': 'MISS' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

/**
 * GET /v1/players/:id
 * Full player profile — batting + pitching if applicable.
 */
players.get('/:id', async (c) => {
  const playerId = c.req.param('id');
  const tier = c.get('tier') || 'free';

  const cacheKey = `player:${playerId}:${tier}`;
  const cached = await kvGet<unknown>(c.env.CACHE, cacheKey);
  if (cached) {
    return cachedJson({ data: cached, meta: buildMeta('bsi-cbb-api', true, tier) }, 200, 300, { 'X-Cache': 'HIT' });
  }

  try {
    const batting = await c.env.DB.prepare(
      'SELECT * FROM cbb_batting_advanced WHERE player_id = ? AND season = ?'
    ).bind(playerId, SEASON).first();

    const pitching = await c.env.DB.prepare(
      'SELECT * FROM cbb_pitching_advanced WHERE player_id = ? AND season = ?'
    ).bind(playerId, SEASON).first();

    if (!batting && !pitching) {
      return notFound('Player', playerId);
    }

    let player: Record<string, unknown> = {
      player_id: playerId,
      batting: batting || null,
      pitching: pitching || null,
      type: batting && pitching ? 'two-way' : batting ? 'hitter' : 'pitcher',
    };

    if (tier === 'free') {
      if (batting) player.batting = stripProFields(batting as Record<string, unknown>);
      if (pitching) player.pitching = stripProFields(pitching as Record<string, unknown>);
    }

    await kvPut(c.env.CACHE, cacheKey, player, 300);
    return cachedJson({ data: player, meta: buildMeta('bsi-cbb-api', false, tier) }, 200, 300, { 'X-Cache': 'MISS' });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

/**
 * GET /v1/players/:id/batting
 * Batting stats for a specific player.
 */
players.get('/:id/batting', async (c) => {
  const playerId = c.req.param('id');
  const tier = c.get('tier') || 'free';

  try {
    const batting = await c.env.DB.prepare(
      'SELECT * FROM cbb_batting_advanced WHERE player_id = ? AND season = ?'
    ).bind(playerId, SEASON).first();

    if (!batting) return notFound('Player batting data', playerId);

    let data = batting as Record<string, unknown>;
    if (tier === 'free') data = stripProFields(data);

    return cachedJson({ data, meta: buildMeta('bsi-cbb-api', false, tier) }, 200, 300);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

/**
 * GET /v1/players/:id/pitching
 * Pitching stats for a specific player.
 */
players.get('/:id/pitching', async (c) => {
  const playerId = c.req.param('id');
  const tier = c.get('tier') || 'free';

  try {
    const pitching = await c.env.DB.prepare(
      'SELECT * FROM cbb_pitching_advanced WHERE player_id = ? AND season = ?'
    ).bind(playerId, SEASON).first();

    if (!pitching) return notFound('Player pitching data', playerId);

    let data = pitching as Record<string, unknown>;
    if (tier === 'free') data = stripProFields(data);

    return cachedJson({ data, meta: buildMeta('bsi-cbb-api', false, tier) }, 200, 300);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

export default players;
