import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, Tier } from '../../shared/types';
import { cachedJson } from '../../shared/helpers';
import { maxRows } from '../../middleware/tier-gate';

type Row = Record<string, unknown>;
type HistoryState = 'loading' | 'error' | 'empty' | 'populated';

const TIMEZONE = 'America/Chicago' as const;
const SOURCE = 'bsi-d1-history';

const history = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

function intParam(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function meta(fetchedAt: string | null, tier: Tier, cacheHit = false) {
  return {
    source: SOURCE,
    fetched_at: fetchedAt || new Date().toISOString(),
    timezone: TIMEZONE,
    tier,
    cache_hit: cacheHit,
  };
}

function envelope<T>(data: T, state: HistoryState, fetchedAt: string | null, tier: Tier, error?: string) {
  return {
    data,
    state,
    meta: meta(fetchedAt, tier),
    ...(error ? { error } : {}),
  };
}

async function sourceFetchedAt(env: Env): Promise<string | null> {
  try {
    const row = await env.DB.prepare(
      'SELECT MAX(retrieved_at) AS fetched_at FROM bsi_history_source_snapshot'
    ).first<{ fetched_at: string | null }>();
    return row?.fetched_at || null;
  } catch {
    return null;
  }
}

async function listRows(
  env: Env,
  sql: string,
  binds: (string | number)[],
): Promise<Row[]> {
  const { results } = await env.DB.prepare(sql).bind(...binds).all<Row>();
  return results as Row[];
}

type HistoryContext = Context<{ Bindings: Env; Variables: { tier: Tier } }>;

function jsonError(_c: HistoryContext, message: string, tier: Tier) {
  return cachedJson(envelope([], 'error', null, tier, message), 500, 0);
}

history.get('/seasons', async (c) => {
  const tier = c.get('tier') || 'free';
  const limit = Math.min(intParam(c.req.query('limit'), 100), maxRows(tier));
  const offset = intParam(c.req.query('offset'), 0);
  try {
    const rows = await listRows(
      c.env,
      `SELECT * FROM bsi_history_canonical_season ORDER BY year DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    const fetchedAt = await sourceFetchedAt(c.env);
    return cachedJson(envelope(rows, rows.length ? 'populated' : 'empty', fetchedAt, tier), 200, 300);
  } catch (err) {
    return jsonError(c, err instanceof Error ? err.message : 'Unknown error', tier);
  }
});

history.get('/teams', async (c) => {
  const tier = c.get('tier') || 'free';
  const season = c.req.query('season');
  const limit = Math.min(intParam(c.req.query('limit'), 100), maxRows(tier));
  const offset = intParam(c.req.query('offset'), 0);
  try {
    const rows = season
      ? await listRows(
          c.env,
          `SELECT t.*
           FROM bsi_history_canonical_team t
           INNER JOIN bsi_history_team_season ts ON ts.team_id = t.team_id
           WHERE ts.season_id = ?
           ORDER BY t.school_name ASC LIMIT ? OFFSET ?`,
          [season, limit, offset],
        )
      : await listRows(
          c.env,
          `SELECT * FROM bsi_history_canonical_team ORDER BY school_name ASC LIMIT ? OFFSET ?`,
          [limit, offset],
        );
    const fetchedAt = await sourceFetchedAt(c.env);
    return cachedJson(envelope(rows, rows.length ? 'populated' : 'empty', fetchedAt, tier), 200, 300);
  } catch (err) {
    return jsonError(c, err instanceof Error ? err.message : 'Unknown error', tier);
  }
});

history.get('/teams/:teamId/seasons', async (c) => {
  const tier = c.get('tier') || 'free';
  const teamId = c.req.param('teamId');
  try {
    const rows = await listRows(
      c.env,
      `SELECT * FROM bsi_history_team_season WHERE team_id = ? ORDER BY season_id DESC`,
      [teamId],
    );
    const fetchedAt = await sourceFetchedAt(c.env);
    return cachedJson(envelope(rows, rows.length ? 'populated' : 'empty', fetchedAt, tier), 200, 300);
  } catch (err) {
    return jsonError(c, err instanceof Error ? err.message : 'Unknown error', tier);
  }
});

history.get('/games', async (c) => {
  const tier = c.get('tier') || 'free';
  const season = c.req.query('season') || '2026-d1';
  const teamId = c.req.query('teamId');
  const status = c.req.query('status');
  const limit = Math.min(intParam(c.req.query('limit'), 100), maxRows(tier));
  const offset = intParam(c.req.query('offset'), 0);
  try {
    let sql = `SELECT * FROM bsi_history_canonical_game WHERE season_id = ?`;
    const binds: (string | number)[] = [season];
    if (teamId) {
      sql += ` AND (team_id_home = ? OR team_id_away = ?)`;
      binds.push(teamId, teamId);
    }
    if (status) {
      sql += ` AND status = ?`;
      binds.push(status);
    }
    sql += ` ORDER BY date_start DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);
    const rows = await listRows(c.env, sql, binds);
    const fetchedAt = await sourceFetchedAt(c.env);
    return cachedJson(envelope(rows, rows.length ? 'populated' : 'empty', fetchedAt, tier), 200, 120);
  } catch (err) {
    return jsonError(c, err instanceof Error ? err.message : 'Unknown error', tier);
  }
});

history.get('/games/:gameId/box-score', async (c) => {
  const tier = c.get('tier') || 'free';
  const gameId = c.req.param('gameId');
  try {
    const [teams, batting, pitching] = await Promise.all([
      listRows(c.env, `SELECT * FROM bsi_history_game_team_line WHERE game_id = ? ORDER BY home_away`, [gameId]),
      listRows(c.env, `SELECT * FROM bsi_history_player_game_batting WHERE game_id = ? ORDER BY team_id, batting_order`, [gameId]),
      listRows(c.env, `SELECT * FROM bsi_history_player_game_pitching WHERE game_id = ? ORDER BY team_id, starter DESC, player_id`, [gameId]),
    ]);
    const data = { game_id: gameId, teams, batting, pitching };
    const fetchedAt = await sourceFetchedAt(c.env);
    const populated = teams.length > 0 || batting.length > 0 || pitching.length > 0;
    return cachedJson(envelope(data, populated ? 'populated' : 'empty', fetchedAt, tier), 200, 120);
  } catch (err) {
    return jsonError(c, err instanceof Error ? err.message : 'Unknown error', tier);
  }
});

history.get('/games/:gameId/play-by-play', async (c) => {
  const tier = c.get('tier') || 'free';
  const gameId = c.req.param('gameId');
  const limit = Math.min(intParam(c.req.query('limit'), 400), tier === 'free' ? 100 : 1000);
  const offset = intParam(c.req.query('offset'), 0);
  try {
    const rows = await listRows(
      c.env,
      `SELECT * FROM bsi_history_play_by_play_event
       WHERE game_id = ? ORDER BY sequence_number ASC LIMIT ? OFFSET ?`,
      [gameId, limit, offset],
    );
    const fetchedAt = await sourceFetchedAt(c.env);
    return cachedJson(envelope(rows, rows.length ? 'populated' : 'empty', fetchedAt, tier), 200, 120);
  } catch (err) {
    return jsonError(c, err instanceof Error ? err.message : 'Unknown error', tier);
  }
});

history.get('/tournaments', async (c) => {
  const tier = c.get('tier') || 'free';
  const season = c.req.query('season');
  try {
    const rows = season
      ? await listRows(c.env, `SELECT * FROM bsi_history_tournament_game WHERE season_id = ? ORDER BY round_name`, [season])
      : await listRows(c.env, `SELECT * FROM bsi_history_championship_result ORDER BY season_id DESC`, []);
    const fetchedAt = await sourceFetchedAt(c.env);
    return cachedJson(envelope(rows, rows.length ? 'populated' : 'empty', fetchedAt, tier), 200, 600);
  } catch (err) {
    return jsonError(c, err instanceof Error ? err.message : 'Unknown error', tier);
  }
});

history.get('/polls', async (c) => {
  const tier = c.get('tier') || 'free';
  const season = c.req.query('season') || '2026-d1';
  const poll = c.req.query('poll');
  try {
    const rows = poll
      ? await listRows(
          c.env,
          `SELECT * FROM bsi_history_poll_ranking WHERE season_id = ? AND poll_name = ? ORDER BY rank ASC`,
          [season, poll],
        )
      : await listRows(
          c.env,
          `SELECT * FROM bsi_history_poll_ranking WHERE season_id = ? ORDER BY poll_date DESC, poll_name, rank ASC`,
          [season],
        );
    const fetchedAt = await sourceFetchedAt(c.env);
    return cachedJson(envelope(rows, rows.length ? 'populated' : 'empty', fetchedAt, tier), 200, 300);
  } catch (err) {
    return jsonError(c, err instanceof Error ? err.message : 'Unknown error', tier);
  }
});

history.get('/awards', async (c) => {
  const tier = c.get('tier') || 'free';
  const season = c.req.query('season');
  try {
    const rows = season
      ? await listRows(c.env, `SELECT * FROM bsi_history_award_winner WHERE season_id = ? ORDER BY award_name`, [season])
      : await listRows(c.env, `SELECT * FROM bsi_history_award_winner ORDER BY season_id DESC, award_name LIMIT ?`, [maxRows(tier)]);
    const fetchedAt = await sourceFetchedAt(c.env);
    return cachedJson(envelope(rows, rows.length ? 'populated' : 'empty', fetchedAt, tier), 200, 600);
  } catch (err) {
    return jsonError(c, err instanceof Error ? err.message : 'Unknown error', tier);
  }
});

history.get('/provenance/:recordId', async (c) => {
  const tier = c.get('tier') || 'free';
  const recordId = c.req.param('recordId');
  try {
    const row = await c.env.DB.prepare(
      `SELECT source_snapshot_id, source_system_id, source_url, snapshot_kind, retrieved_at,
              raw_sha256, access_state, http_status, parser_version, notes
       FROM bsi_history_source_snapshot
       WHERE source_snapshot_id = ?`
    ).bind(recordId).first<Row>();
    const fetchedAt = await sourceFetchedAt(c.env);
    return cachedJson(envelope(row || null, row ? 'populated' : 'empty', fetchedAt, tier), 200, 600);
  } catch (err) {
    return jsonError(c, err instanceof Error ? err.message : 'Unknown error', tier);
  }
});

export default history;
