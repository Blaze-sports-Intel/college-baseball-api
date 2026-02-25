/**
 * MCP Tool Definitions — 12 tools for college baseball analytics.
 * Each tool maps to a REST endpoint handler.
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'cbb_player_lookup',
    description: 'Find a college baseball player by name or ID. Returns basic info and available stats.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Player name to search for' },
        player_id: { type: 'string', description: 'Exact player ID if known' },
      },
    },
  },
  {
    name: 'cbb_player_stats',
    description: 'Get advanced batting and/or pitching statistics for a player. Includes wOBA, wRC+, FIP, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: { type: 'string', description: 'Player ID' },
        type: { type: 'string', description: 'Stats type: batting, pitching, or both', enum: ['batting', 'pitching', 'both'] },
      },
      required: ['player_id'],
    },
  },
  {
    name: 'cbb_compare_players',
    description: 'Head-to-head statistical comparison of 2-5 college baseball players.',
    inputSchema: {
      type: 'object',
      properties: {
        player_ids: { type: 'string', description: 'Comma-separated player IDs (2-5)' },
        type: { type: 'string', description: 'Comparison type: batting or pitching', enum: ['batting', 'pitching'] },
      },
      required: ['player_ids', 'type'],
    },
  },
  {
    name: 'cbb_leaderboard',
    description: 'Get the leaderboard for any batting or pitching metric. Supports conference and position filters.',
    inputSchema: {
      type: 'object',
      properties: {
        metric: { type: 'string', description: 'Metric to sort by (e.g., woba, fip, wrc_plus, era, k_9)' },
        type: { type: 'string', description: 'Leaderboard type', enum: ['batting', 'pitching'] },
        conference: { type: 'string', description: 'Filter by conference (e.g., SEC, Big 12)' },
        position: { type: 'string', description: 'Filter by position (e.g., OF, SS, SP)' },
        limit: { type: 'string', description: 'Number of results (default 25, max 100)' },
      },
      required: ['metric', 'type'],
    },
  },
  {
    name: 'cbb_team_analytics',
    description: 'Get team aggregate statistics and roster with advanced metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: { type: 'string', description: 'Team ID' },
      },
      required: ['team_id'],
    },
  },
  {
    name: 'cbb_park_factor',
    description: 'Get the park factor for a team\'s home venue. Values above 1.0 are hitter-friendly.',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: { type: 'string', description: 'Team ID' },
      },
      required: ['team_id'],
    },
  },
  {
    name: 'cbb_conference_strength',
    description: 'Get conference strength rankings with composite index (0-100). Optionally filter to a single conference.',
    inputSchema: {
      type: 'object',
      properties: {
        conference: { type: 'string', description: 'Specific conference name (optional — omit for all)' },
      },
    },
  },
  {
    name: 'cbb_compute_batting',
    description: 'Stateless computation: provide raw batting stats, receive full advanced analytics (wOBA, wRC+, OPS+, ISO, BABIP, eBA, eSLG, ewOBA). No database lookup — pure math.',
    inputSchema: {
      type: 'object',
      properties: {
        pa: { type: 'string', description: 'Plate appearances' },
        ab: { type: 'string', description: 'At bats' },
        h: { type: 'string', description: 'Hits' },
        doubles: { type: 'string', description: 'Doubles' },
        triples: { type: 'string', description: 'Triples' },
        hr: { type: 'string', description: 'Home runs' },
        bb: { type: 'string', description: 'Walks' },
        hbp: { type: 'string', description: 'Hit by pitch' },
        so: { type: 'string', description: 'Strikeouts' },
        sf: { type: 'string', description: 'Sacrifice flies' },
      },
      required: ['pa', 'ab', 'h', 'doubles', 'triples', 'hr', 'bb', 'hbp', 'so', 'sf'],
    },
  },
  {
    name: 'cbb_compute_pitching',
    description: 'Stateless computation: provide raw pitching stats, receive full advanced analytics (FIP, ERA-, K/9, BB/9, K/BB, LOB%, BABIP). No database lookup — pure math.',
    inputSchema: {
      type: 'object',
      properties: {
        ip: { type: 'string', description: 'Innings pitched (decimal: 6.1 = 6 1/3)' },
        h: { type: 'string', description: 'Hits allowed' },
        er: { type: 'string', description: 'Earned runs' },
        hr: { type: 'string', description: 'Home runs allowed' },
        bb: { type: 'string', description: 'Walks' },
        hbp: { type: 'string', description: 'Hit batters' },
        so: { type: 'string', description: 'Strikeouts' },
      },
      required: ['ip', 'h', 'er', 'hr', 'bb', 'hbp', 'so'],
    },
  },
  {
    name: 'cbb_havf_player',
    description: 'Get HAV-F composite score breakdown for a player. BSI proprietary metric: Hits/At-Bat Quality/Velocity proxy/Fielding on 0-100 percentile scale.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: { type: 'string', description: 'Player ID' },
      },
      required: ['player_id'],
    },
  },
  {
    name: 'cbb_mmi_game',
    description: 'Get Momentum Magnitude Index timeline for a game. Shows momentum swings from -100 (away) to +100 (home) at each game state.',
    inputSchema: {
      type: 'object',
      properties: {
        game_id: { type: 'string', description: 'Game ID' },
      },
      required: ['game_id'],
    },
  },
  {
    name: 'cbb_glossary',
    description: 'Look up the definition, formula, and tier of any college baseball metric.',
    inputSchema: {
      type: 'object',
      properties: {
        metric: { type: 'string', description: 'Metric name (e.g., woba, fip, havf, mmi, babip)' },
      },
      required: ['metric'],
    },
  },
];
