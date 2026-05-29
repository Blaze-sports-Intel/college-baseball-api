-- 003_history.sql
-- Source-backed NCAA D1 baseball history serving tables.
-- Raw PDFs and source JSON stay outside public D1 tables.

CREATE TABLE IF NOT EXISTS bsi_history_canonical_season (
  season_id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  division TEXT NOT NULL,
  season_scope TEXT NOT NULL,
  official_stats_available INTEGER NOT NULL DEFAULT 1,
  start_date TEXT,
  end_date TEXT,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  retrieved_at TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_canonical_team (
  team_id TEXT PRIMARY KEY,
  school_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  short_name TEXT,
  ncaa_org_code TEXT,
  division TEXT NOT NULL DEFAULT 'D1',
  active_from_year INTEGER,
  active_to_year INTEGER,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  retrieved_at TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_team_alias (
  alias_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  alias_type TEXT NOT NULL,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_canonical_player (
  player_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  bats TEXT,
  throws TEXT,
  primary_pos TEXT,
  hometown TEXT,
  active_from_year INTEGER,
  active_to_year INTEGER,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_team_season (
  team_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  games INTEGER,
  wins INTEGER,
  losses INTEGER,
  ties INTEGER,
  conference_wins INTEGER,
  conference_losses INTEGER,
  runs_scored INTEGER,
  runs_allowed INTEGER,
  rpi_rank INTEGER,
  postseason_result TEXT,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  retrieved_at TEXT,
  parser_version TEXT,
  raw_sha256 TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT,
  PRIMARY KEY (team_id, season_id)
);

CREATE TABLE IF NOT EXISTS bsi_history_canonical_game (
  game_id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  date_start TEXT,
  team_id_home TEXT,
  team_id_away TEXT,
  venue_id TEXT,
  status TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  doubleheader_n INTEGER,
  neutral_site INTEGER NOT NULL DEFAULT 0,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  retrieved_at TEXT,
  parser_version TEXT,
  raw_sha256 TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_game_team_line (
  game_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  home_away TEXT NOT NULL,
  runs INTEGER,
  hits INTEGER,
  errors INTEGER,
  innings_json TEXT,
  batting_json TEXT,
  pitching_json TEXT,
  fielding_json TEXT,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  retrieved_at TEXT,
  parser_version TEXT,
  raw_sha256 TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT,
  PRIMARY KEY (game_id, team_id)
);

CREATE TABLE IF NOT EXISTS bsi_history_player_game_batting (
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  batting_order INTEGER,
  position TEXT,
  starter INTEGER,
  ab INTEGER,
  r INTEGER,
  h INTEGER,
  rbi INTEGER,
  hr INTEGER,
  bb INTEGER,
  so INTEGER,
  pitches_seen INTEGER,
  avg REAL,
  obp REAL,
  slg REAL,
  raw_stats_json TEXT,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  retrieved_at TEXT,
  parser_version TEXT,
  raw_sha256 TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT,
  PRIMARY KEY (game_id, player_id, team_id)
);

CREATE TABLE IF NOT EXISTS bsi_history_player_game_pitching (
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  position TEXT,
  starter INTEGER,
  ip_outs INTEGER,
  h INTEGER,
  r INTEGER,
  er INTEGER,
  bb INTEGER,
  so INTEGER,
  hr INTEGER,
  pitches INTEGER,
  strikes INTEGER,
  era REAL,
  raw_stats_json TEXT,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  retrieved_at TEXT,
  parser_version TEXT,
  raw_sha256 TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT,
  PRIMARY KEY (game_id, player_id, team_id)
);

CREATE TABLE IF NOT EXISTS bsi_history_play_by_play_event (
  play_id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  sequence_number INTEGER,
  inning INTEGER,
  inning_half TEXT,
  play_type TEXT,
  play_text TEXT NOT NULL,
  team_id TEXT,
  home_score INTEGER,
  away_score INTEGER,
  outs INTEGER,
  pitch_count TEXT,
  scoring_play INTEGER NOT NULL DEFAULT 0,
  wallclock TEXT,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  retrieved_at TEXT,
  parser_version TEXT,
  raw_sha256 TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_tournament_game (
  tournament_game_id TEXT PRIMARY KEY,
  game_id TEXT,
  season_id TEXT NOT NULL,
  round_name TEXT NOT NULL,
  regional_name TEXT,
  bracket_position TEXT,
  host_team_id TEXT,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_championship_result (
  season_id TEXT NOT NULL,
  division TEXT NOT NULL DEFAULT 'D1',
  champion_team_id TEXT,
  champion_name_raw TEXT NOT NULL,
  runner_up_team_id TEXT,
  runner_up_name_raw TEXT,
  cws_site TEXT,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT,
  PRIMARY KEY (season_id, division)
);

CREATE TABLE IF NOT EXISTS bsi_history_poll_ranking (
  poll_ranking_id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  poll_name TEXT NOT NULL,
  poll_date TEXT,
  rank INTEGER NOT NULL,
  team_id TEXT,
  team_name_raw TEXT NOT NULL,
  points REAL,
  previous_rank INTEGER,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_award_winner (
  award_winner_id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  award_name TEXT NOT NULL,
  player_id TEXT,
  player_name_raw TEXT,
  team_id TEXT,
  team_name_raw TEXT,
  source_system_id TEXT,
  source_snapshot_id TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_source_snapshot (
  source_snapshot_id TEXT PRIMARY KEY,
  source_system_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  snapshot_kind TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  raw_sha256 TEXT NOT NULL,
  raw_path TEXT NOT NULL,
  access_state TEXT NOT NULL,
  http_status INTEGER,
  parser_version TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_source_discovery (
  discovery_id TEXT PRIMARY KEY,
  discovery_tool TEXT NOT NULL,
  query TEXT NOT NULL,
  result_title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  access_type TEXT NOT NULL,
  source_rank TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  discovered_at TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bsi_history_coverage_matrix (
  coverage_id TEXT PRIMARY KEY,
  source_system_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  season_id TEXT,
  expected_records INTEGER,
  available_records INTEGER NOT NULL DEFAULT 0,
  canonical_records INTEGER NOT NULL DEFAULT 0,
  access_state TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_games_season ON bsi_history_canonical_game(season_id, date_start);
CREATE INDEX IF NOT EXISTS idx_history_team_season_team ON bsi_history_team_season(team_id, season_id);
CREATE INDEX IF NOT EXISTS idx_history_team_alias_team ON bsi_history_team_alias(team_id);
CREATE INDEX IF NOT EXISTS idx_history_pbp_game ON bsi_history_play_by_play_event(game_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_history_batting_game ON bsi_history_player_game_batting(game_id, team_id);
CREATE INDEX IF NOT EXISTS idx_history_pitching_game ON bsi_history_player_game_pitching(game_id, team_id);
