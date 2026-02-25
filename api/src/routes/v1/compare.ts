import { Hono } from 'hono';
import type { Env, Tier } from '../../shared/types';
import { buildMeta } from '../../shared/helpers';
import { badRequest, serverError } from '../../shared/errors';

const SEASON = 2026;

const compare = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

/**
 * GET /v1/compare/batting?players=id1,id2
 * Head-to-head batting comparison. Pro tier. Up to 5 players.
 */
compare.get('/batting', async (c) => {
  const playerIds = (c.req.query('players') || '').split(',').filter(Boolean);

  if (playerIds.length < 2) return badRequest('Provide at least 2 player IDs');
  if (playerIds.length > 5) return badRequest('Maximum 5 players per comparison');

  try {
    const placeholders = playerIds.map(() => '?').join(', ');
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM cbb_batting_advanced
      WHERE player_id IN (${placeholders}) AND season = ?
    `).bind(...playerIds, SEASON).all();

    return c.json({
      data: {
        players: results,
        compared_ids: playerIds,
      },
      meta: buildMeta('bsi-cbb-api', false, 'pro'),
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

/**
 * GET /v1/compare/pitching?players=id1,id2
 * Head-to-head pitching comparison. Pro tier. Up to 5 players.
 */
compare.get('/pitching', async (c) => {
  const playerIds = (c.req.query('players') || '').split(',').filter(Boolean);

  if (playerIds.length < 2) return badRequest('Provide at least 2 player IDs');
  if (playerIds.length > 5) return badRequest('Maximum 5 players per comparison');

  try {
    const placeholders = playerIds.map(() => '?').join(', ');
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM cbb_pitching_advanced
      WHERE player_id IN (${placeholders}) AND season = ?
    `).bind(...playerIds, SEASON).all();

    return c.json({
      data: {
        players: results,
        compared_ids: playerIds,
      },
      meta: buildMeta('bsi-cbb-api', false, 'pro'),
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Unknown error');
  }
});

export default compare;
