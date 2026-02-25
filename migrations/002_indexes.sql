-- Indexes for query performance
-- Matches the access patterns in route handlers

-- Batting: leaderboard queries sort by various metrics with conference/position filters
CREATE INDEX IF NOT EXISTS idx_batting_season ON cbb_batting_advanced(season);
CREATE INDEX IF NOT EXISTS idx_batting_conference ON cbb_batting_advanced(conference, season);
CREATE INDEX IF NOT EXISTS idx_batting_team ON cbb_batting_advanced(team_id, season);
CREATE INDEX IF NOT EXISTS idx_batting_woba ON cbb_batting_advanced(season, woba DESC);
CREATE INDEX IF NOT EXISTS idx_batting_wrc ON cbb_batting_advanced(season, wrc_plus DESC);
CREATE INDEX IF NOT EXISTS idx_batting_name ON cbb_batting_advanced(player_name, season);

-- Pitching: same pattern
CREATE INDEX IF NOT EXISTS idx_pitching_season ON cbb_pitching_advanced(season);
CREATE INDEX IF NOT EXISTS idx_pitching_conference ON cbb_pitching_advanced(conference, season);
CREATE INDEX IF NOT EXISTS idx_pitching_team ON cbb_pitching_advanced(team_id, season);
CREATE INDEX IF NOT EXISTS idx_pitching_fip ON cbb_pitching_advanced(season, fip ASC);
CREATE INDEX IF NOT EXISTS idx_pitching_era ON cbb_pitching_advanced(season, era ASC);

-- Park factors: by conference
CREATE INDEX IF NOT EXISTS idx_parks_conference ON cbb_park_factors(conference, season);

-- Conference strength: by season + sort
CREATE INDEX IF NOT EXISTS idx_conf_season ON cbb_conference_strength(season, strength_index DESC);

-- HAV-F: composite leaderboard
CREATE INDEX IF NOT EXISTS idx_havf_composite ON havf_scores(season, havf_composite DESC);
CREATE INDEX IF NOT EXISTS idx_havf_conference ON havf_scores(conference, season);

-- MMI: game lookup
CREATE INDEX IF NOT EXISTS idx_mmi_game ON mmi_snapshots(game_id, snapshot_order);
CREATE INDEX IF NOT EXISTS idx_mmi_summary_volatility ON mmi_game_summaries(volatility DESC);
