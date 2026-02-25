-- College Baseball API — Core Schema
-- Database: cbb-api-db (D1)
-- Synced from BSI's bsi-prod-db via cbb-api-sync worker

-- Batting advanced stats (from cbb_batting_advanced in BSI)
CREATE TABLE IF NOT EXISTS cbb_batting_advanced (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  team_id TEXT,
  conference TEXT,
  position TEXT,
  class_year TEXT,
  season INTEGER NOT NULL,

  -- Traditional
  g INTEGER DEFAULT 0,
  ab INTEGER DEFAULT 0,
  pa INTEGER DEFAULT 0,
  h INTEGER DEFAULT 0,
  doubles INTEGER DEFAULT 0,
  triples INTEGER DEFAULT 0,
  hr INTEGER DEFAULT 0,
  r INTEGER DEFAULT 0,
  rbi INTEGER DEFAULT 0,
  bb INTEGER DEFAULT 0,
  hbp INTEGER DEFAULT 0,
  so INTEGER DEFAULT 0,
  sf INTEGER DEFAULT 0,
  sb INTEGER DEFAULT 0,
  cs INTEGER DEFAULT 0,

  -- Rate stats
  avg REAL DEFAULT 0,
  obp REAL DEFAULT 0,
  slg REAL DEFAULT 0,
  ops REAL DEFAULT 0,
  k_pct REAL DEFAULT 0,
  bb_pct REAL DEFAULT 0,
  iso REAL DEFAULT 0,
  babip REAL DEFAULT 0,

  -- Advanced (pro tier)
  woba REAL DEFAULT 0,
  wrc_plus REAL DEFAULT 0,
  ops_plus REAL DEFAULT 0,
  e_ba REAL DEFAULT 0,
  e_slg REAL DEFAULT 0,
  e_woba REAL DEFAULT 0,

  -- Metadata
  stats_source TEXT DEFAULT 'bsi-sync',
  synced_at TEXT,

  UNIQUE(player_id, season)
);

-- Pitching advanced stats (from cbb_pitching_advanced in BSI)
CREATE TABLE IF NOT EXISTS cbb_pitching_advanced (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  team_id TEXT,
  conference TEXT,
  position TEXT,
  class_year TEXT,
  season INTEGER NOT NULL,

  -- Traditional
  g INTEGER DEFAULT 0,
  gs INTEGER DEFAULT 0,
  w INTEGER DEFAULT 0,
  l INTEGER DEFAULT 0,
  sv INTEGER DEFAULT 0,
  ip REAL DEFAULT 0,
  h INTEGER DEFAULT 0,
  er INTEGER DEFAULT 0,
  bb INTEGER DEFAULT 0,
  hbp INTEGER DEFAULT 0,
  so INTEGER DEFAULT 0,
  hr INTEGER DEFAULT 0,

  -- Rate stats
  era REAL DEFAULT 0,
  whip REAL DEFAULT 0,
  k_9 REAL DEFAULT 0,
  bb_9 REAL DEFAULT 0,
  hr_9 REAL DEFAULT 0,

  -- Advanced (pro tier)
  fip REAL DEFAULT 0,
  x_fip REAL,
  era_minus REAL DEFAULT 0,
  k_bb REAL DEFAULT 0,
  lob_pct REAL DEFAULT 0,
  babip REAL DEFAULT 0,

  -- Metadata
  stats_source TEXT DEFAULT 'bsi-sync',
  synced_at TEXT,

  UNIQUE(player_id, season)
);

-- Park factors
CREATE TABLE IF NOT EXISTS cbb_park_factors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team TEXT NOT NULL,
  team_id TEXT,
  venue_name TEXT,
  conference TEXT,
  season INTEGER NOT NULL,
  runs_factor REAL DEFAULT 1.0,
  hits_factor REAL DEFAULT 1.0,
  hr_factor REAL DEFAULT 1.0,
  bb_factor REAL DEFAULT 1.0,
  so_factor REAL DEFAULT 1.0,
  sample_games INTEGER DEFAULT 0,
  methodology_note TEXT,

  UNIQUE(team_id, season)
);

-- Conference strength rankings
CREATE TABLE IF NOT EXISTS cbb_conference_strength (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conference TEXT NOT NULL,
  season INTEGER NOT NULL,
  strength_index REAL DEFAULT 50,
  run_environment REAL,
  avg_era REAL,
  avg_ops REAL,
  avg_woba REAL,
  inter_conf_win_pct REAL,
  rpi_avg REAL,
  is_power INTEGER DEFAULT 0,

  UNIQUE(conference, season)
);

-- HAV-F composite scores
CREATE TABLE IF NOT EXISTS havf_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  conference TEXT,
  season INTEGER NOT NULL,
  h_score REAL DEFAULT 0,
  a_score REAL DEFAULT 0,
  v_score REAL DEFAULT 0,
  f_score REAL DEFAULT 0,
  havf_composite REAL DEFAULT 0,
  breakdown_json TEXT,
  computed_at TEXT,

  UNIQUE(player_id, season)
);

-- MMI snapshots (per-game momentum data)
CREATE TABLE IF NOT EXISTS mmi_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  snapshot_order INTEGER NOT NULL,
  value REAL NOT NULL,
  direction TEXT,
  magnitude TEXT,
  sd REAL,
  rs REAL,
  gp REAL,
  bs REAL,
  computed_at TEXT
);

-- MMI game summaries
CREATE TABLE IF NOT EXISTS mmi_game_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL UNIQUE,
  max_mmi REAL,
  min_mmi REAL,
  avg_mmi REAL,
  volatility REAL,
  lead_changes INTEGER DEFAULT 0,
  max_swing REAL,
  excitement_rating TEXT,
  computed_at TEXT
);

-- Sync metadata
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  rows_synced INTEGER DEFAULT 0,
  synced_at TEXT NOT NULL,
  duration_ms INTEGER,
  status TEXT DEFAULT 'success'
);
