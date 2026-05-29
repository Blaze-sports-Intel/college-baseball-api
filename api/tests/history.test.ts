import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import history from '../src/routes/v1/history';
import type { Env, Tier } from '../src/shared/types';

type Row = Record<string, unknown>;

class FakePrepared {
  constructor(private readonly sql: string, private readonly db: FakeD1) {}
  private binds: unknown[] = [];

  bind(...binds: unknown[]) {
    this.binds = binds;
    return this;
  }

  async all<T = Row>() {
    return { results: this.db.query(this.sql, this.binds) as T[] };
  }

  async first<T = Row>() {
    return (this.db.query(this.sql, this.binds)[0] || null) as T | null;
  }
}

class FakeD1 {
  prepare(sql: string) {
    return new FakePrepared(sql, this);
  }

  query(sql: string, binds: unknown[]): Row[] {
    if (sql.includes('MAX(retrieved_at)')) {
      return [{ fetched_at: '2026-05-29T10:00:00Z' }];
    }
    if (sql.includes('bsi_history_canonical_season')) {
      return [{ season_id: '2026-d1', year: 2026, division: 'D1' }];
    }
    if (sql.includes('bsi_history_canonical_game')) {
      return [{
        game_id: 'espn_1',
        season_id: binds[0],
        status: 'final',
        home_score: 5,
        away_score: 3,
      }];
    }
    if (sql.includes('bsi_history_game_team_line')) {
      return [{ game_id: binds[0], team_id: 'espn_10_baseball_m', home_away: 'home', runs: 5 }];
    }
    if (sql.includes('bsi_history_player_game_batting')) {
      return [{ game_id: binds[0], player_id: 'espn_player_1', h: 2, ab: 4 }];
    }
    if (sql.includes('bsi_history_player_game_pitching')) {
      return [{ game_id: binds[0], player_id: 'espn_player_2', ip_outs: 5 }];
    }
    if (sql.includes('bsi_history_play_by_play_event')) {
      return [{ play_id: 'play-1', game_id: binds[0], sequence_number: 1, play_text: 'Batter singled.' }];
    }
    if (sql.includes('bsi_history_source_snapshot')) {
      return [{
        source_snapshot_id: binds[0],
        source_system_id: 'espn_college_baseball',
        source_url: 'https://example.test/summary',
        access_state: 'available',
      }];
    }
    return [];
  }
}

function env(): Env {
  return {
    DB: new FakeD1() as unknown as D1Database,
    CACHE: {} as KVNamespace,
    API_KEYS: {} as KVNamespace,
    ENVIRONMENT: 'test',
    API_VERSION: 'v1',
  };
}

function app() {
  const testApp = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();
  testApp.use('*', async (c, next) => {
    c.set('tier', 'free');
    await next();
  });
  testApp.route('/v1/history', history);
  return testApp;
}

describe('history routes', () => {
  it('returns populated seasons with BSI history metadata', async () => {
    const res = await app().request('/v1/history/seasons', {}, env());
    expect(res.status).toBe(200);
    const body = await res.json() as Row;
    expect(body.state).toBe('populated');
    expect(body.meta).toMatchObject({
      source: 'bsi-d1-history',
      fetched_at: '2026-05-29T10:00:00Z',
      timezone: 'America/Chicago',
    });
  });

  it('returns box score team, batting, and pitching groups', async () => {
    const res = await app().request('/v1/history/games/espn_1/box-score', {}, env());
    expect(res.status).toBe(200);
    const body = await res.json() as { state: string; data: { teams: Row[]; batting: Row[]; pitching: Row[] } };
    expect(body.state).toBe('populated');
    expect(body.data.teams).toHaveLength(1);
    expect(body.data.batting).toHaveLength(1);
    expect(body.data.pitching).toHaveLength(1);
  });

  it('returns provenance without raw payload redistribution', async () => {
    const res = await app().request('/v1/history/provenance/snap_1', {}, env());
    expect(res.status).toBe(200);
    const body = await res.json() as { state: string; data: Row };
    expect(body.state).toBe('populated');
    expect(body.data.source_snapshot_id).toBe('snap_1');
    expect(body.data).not.toHaveProperty('raw_path');
  });
});
