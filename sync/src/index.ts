/**
 * CBB API Sync Worker
 *
 * Cron-triggered (every 5 minutes). Reads from BSI's bsi-prod-db
 * and replicates college baseball analytics tables into cbb-api-db.
 *
 * Unidirectional replication. Full table sync (tables are small).
 * Tables synced:
 *   - cbb_batting_advanced
 *   - cbb_pitching_advanced
 *   - cbb_park_factors
 *   - cbb_conference_strength
 *   - havf_scores
 */

interface Env {
  SOURCE_DB: D1Database;
  TARGET_DB: D1Database;
  SYNC_STATE: KVNamespace;
}

/**
 * Explicit column mappings: source schemas differ from target.
 * Only sync columns the API actually uses. Source-only fields
 * (park_adjusted, data_source, computed_at, pitch_count_*, etc.)
 * are dropped. Target-only fields (hbp on batting, sf, hr on pitching)
 * use defaults or get derived from source columns where available.
 */
const SYNC_CONFIG: Record<string, { sourceColumns: string[]; targetColumns: string[] }> = {
  cbb_batting_advanced: {
    sourceColumns: [
      'player_id', 'player_name', 'team', 'team_id', 'conference', 'position',
      'class_year', 'season', 'g', 'ab', 'pa', 'h', 'doubles', 'triples',
      'hr', 'r', 'rbi', 'bb', 'so', 'sb', 'cs',
      'avg', 'obp', 'slg', 'ops', 'k_pct', 'bb_pct', 'iso', 'babip',
      'woba', 'wrc_plus', 'ops_plus', 'e_ba', 'e_slg', 'e_woba',
    ],
    targetColumns: [
      'player_id', 'player_name', 'team', 'team_id', 'conference', 'position',
      'class_year', 'season', 'g', 'ab', 'pa', 'h', 'doubles', 'triples',
      'hr', 'r', 'rbi', 'bb', 'so', 'sb', 'cs',
      'avg', 'obp', 'slg', 'ops', 'k_pct', 'bb_pct', 'iso', 'babip',
      'woba', 'wrc_plus', 'ops_plus', 'e_ba', 'e_slg', 'e_woba',
    ],
  },
  cbb_pitching_advanced: {
    // BSI source lacks: hr (home runs allowed). Target default (0) applies.
    sourceColumns: [
      'player_id', 'player_name', 'team', 'team_id', 'conference', 'position',
      'class_year', 'season', 'g', 'gs', 'w', 'l', 'sv', 'ip', 'h', 'er',
      'bb', 'hbp', 'so', 'era', 'whip', 'k_9', 'bb_9', 'hr_9',
      'fip', 'x_fip', 'era_minus', 'k_bb', 'lob_pct', 'babip',
    ],
    targetColumns: [
      'player_id', 'player_name', 'team', 'team_id', 'conference', 'position',
      'class_year', 'season', 'g', 'gs', 'w', 'l', 'sv', 'ip', 'h', 'er',
      'bb', 'hbp', 'so', 'era', 'whip', 'k_9', 'bb_9', 'hr_9',
      'fip', 'x_fip', 'era_minus', 'k_bb', 'lob_pct', 'babip',
    ],
  },
  cbb_park_factors: {
    sourceColumns: [
      'team', 'team_id', 'venue_name', 'conference', 'season',
      'runs_factor', 'hits_factor', 'hr_factor', 'bb_factor', 'so_factor',
      'sample_games', 'methodology_note',
    ],
    targetColumns: [
      'team', 'team_id', 'venue_name', 'conference', 'season',
      'runs_factor', 'hits_factor', 'hr_factor', 'bb_factor', 'so_factor',
      'sample_games', 'methodology_note',
    ],
  },
  cbb_conference_strength: {
    // Source may not have all these columns yet — use SELECT * and filter
    sourceColumns: [
      'conference', 'season', 'strength_index', 'run_environment',
      'avg_era', 'avg_ops', 'avg_woba', 'inter_conf_win_pct',
      'rpi_avg', 'is_power',
    ],
    targetColumns: [
      'conference', 'season', 'strength_index', 'run_environment',
      'avg_era', 'avg_ops', 'avg_woba', 'inter_conf_win_pct',
      'rpi_avg', 'is_power',
    ],
  },
  havf_scores: {
    sourceColumns: [
      'player_id', 'player_name', 'team', 'conference', 'season',
      'h_score', 'a_score', 'v_score', 'f_score', 'havf_composite',
      'computed_at',
    ],
    targetColumns: [
      'player_id', 'player_name', 'team', 'conference', 'season',
      'h_score', 'a_score', 'v_score', 'f_score', 'havf_composite',
      'computed_at',
    ],
  },
};

async function syncTable(
  source: D1Database,
  target: D1Database,
  table: string,
  config: { sourceColumns: string[]; targetColumns: string[] },
): Promise<number> {
  const selectCols = config.sourceColumns.join(', ');
  const { results } = await source.prepare(`SELECT ${selectCols} FROM ${table}`).all();

  if (!results || results.length === 0) {
    return 0;
  }

  // Clear target
  await target.prepare(`DELETE FROM ${table}`).run();

  // Insert in batches of 50
  const batchSize = 50;
  let inserted = 0;
  const placeholders = config.targetColumns.map(() => '?').join(', ');
  const insertSQL = `INSERT OR REPLACE INTO ${table} (${config.targetColumns.join(', ')}) VALUES (${placeholders})`;

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const prepared = target.prepare(insertSQL);
    const batchStatements = batch.map(row => {
      const values = config.sourceColumns.map(col => (row as Record<string, unknown>)[col] ?? null);
      return prepared.bind(...values);
    });

    await target.batch(batchStatements);
    inserted += batch.length;
  }

  return inserted;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const startTime = Date.now();
    const results: Record<string, { rows: number; status: string }> = {};

    for (const [table, config] of Object.entries(SYNC_CONFIG)) {
      try {
        const rows = await syncTable(env.SOURCE_DB, env.TARGET_DB, table, config);
        results[table] = { rows, status: 'success' };

        // Log to sync_log table
        await env.TARGET_DB.prepare(`
          INSERT INTO sync_log (table_name, rows_synced, synced_at, duration_ms, status)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          table,
          rows,
          new Date().toISOString(),
          Date.now() - startTime,
          'success',
        ).run();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        results[table] = { rows: 0, status: `error: ${msg}` };
        console.error(`[sync] Failed to sync ${table}:`, msg);
      }
    }

    // Store last sync timestamp
    await env.SYNC_STATE.put('last_synced_at', new Date().toISOString());
    await env.SYNC_STATE.put('last_sync_results', JSON.stringify(results));

    const duration = Date.now() - startTime;
    console.log(`[sync] Complete in ${duration}ms:`, JSON.stringify(results));
  },

  // HTTP endpoint for manual sync or status check
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/status') {
      const lastSynced = await env.SYNC_STATE.get('last_synced_at');
      const lastResults = await env.SYNC_STATE.get('last_sync_results');

      return new Response(JSON.stringify({
        last_synced_at: lastSynced,
        results: lastResults ? JSON.parse(lastResults) : null,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('cbb-api-sync worker', { status: 200 });
  },
};
