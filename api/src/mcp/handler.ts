/**
 * MCP JSON-RPC 2.0 Handler
 *
 * Dispatches MCP protocol methods: initialize, tools/list, tools/call,
 * resources/list, resources/read. Tools call the same logic as REST endpoints.
 */

import type { Env } from '../shared/types';
import { MCP_TOOLS } from './tools';
import { MCP_RESOURCES, resolveStaticResource } from './resources';
import {
  computeFullBattingLine,
  computeFullPitchingLine,
  computeEstimatedBatting,
  DEFAULT_LEAGUE_CONTEXT,
  MLB_WOBA_WEIGHTS,
  METRIC_GLOSSARY,
} from '@bsi/college-baseball-analytics';
import type { BattingLine, PitchingLine } from '@bsi/college-baseball-analytics';

const SERVER_INFO = {
  name: 'bsi-college-baseball',
  version: '0.1.0',
};

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function mcpJsonRpc(id: unknown, result: unknown): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, result }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
  );
}

function mcpError(id: unknown, code: number, message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
  );
}

function toolResult(content: unknown, isError: boolean = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(content) }],
    ...(isError && { isError: true }),
  };
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(
  toolName: string,
  args: Record<string, string>,
  env: Env,
): Promise<unknown> {
  const SEASON = 2026;

  switch (toolName) {
    case 'cbb_player_lookup': {
      if (args.player_id) {
        const batting = await env.DB.prepare(
          'SELECT player_id, player_name, team, conference, position, class_year FROM cbb_batting_advanced WHERE player_id = ? AND season = ?'
        ).bind(args.player_id, SEASON).first();
        return batting || { error: 'Player not found' };
      }
      if (args.query) {
        const { results } = await env.DB.prepare(
          'SELECT player_id, player_name, team, conference, position, class_year FROM cbb_batting_advanced WHERE player_name LIKE ? AND season = ? LIMIT 10'
        ).bind(`%${args.query}%`, SEASON).all();
        return { players: results, count: results.length };
      }
      return { error: 'Provide query or player_id' };
    }

    case 'cbb_player_stats': {
      const type = args.type || 'both';
      const result: Record<string, unknown> = { player_id: args.player_id };

      if (type === 'batting' || type === 'both') {
        result.batting = await env.DB.prepare(
          'SELECT * FROM cbb_batting_advanced WHERE player_id = ? AND season = ?'
        ).bind(args.player_id, SEASON).first();
      }
      if (type === 'pitching' || type === 'both') {
        result.pitching = await env.DB.prepare(
          'SELECT * FROM cbb_pitching_advanced WHERE player_id = ? AND season = ?'
        ).bind(args.player_id, SEASON).first();
      }

      if (!result.batting && !result.pitching) return { error: 'Player not found' };
      return result;
    }

    case 'cbb_compare_players': {
      const ids = (args.player_ids || '').split(',').filter(Boolean);
      if (ids.length < 2 || ids.length > 5) return { error: 'Provide 2-5 player IDs' };

      const table = args.type === 'pitching' ? 'cbb_pitching_advanced' : 'cbb_batting_advanced';
      const placeholders = ids.map(() => '?').join(', ');
      const { results } = await env.DB.prepare(
        `SELECT * FROM ${table} WHERE player_id IN (${placeholders}) AND season = ?`
      ).bind(...ids, SEASON).all();
      return { players: results, type: args.type };
    }

    case 'cbb_leaderboard': {
      const table = args.type === 'pitching' ? 'cbb_pitching_advanced' : 'cbb_batting_advanced';
      const metric = args.metric || (args.type === 'pitching' ? 'fip' : 'woba');
      const limit = Math.min(parseInt(args.limit || '25', 10) || 25, 100);
      const sortDir = args.type === 'pitching' ? 'ASC' : 'DESC';

      let query = `SELECT * FROM ${table} WHERE season = ?`;
      const binds: (string | number)[] = [SEASON];
      if (args.conference) { query += ' AND conference = ?'; binds.push(args.conference); }
      if (args.position) { query += ' AND position = ?'; binds.push(args.position); }
      query += ` ORDER BY ${metric} ${sortDir} LIMIT ?`;
      binds.push(limit);

      const { results } = await env.DB.prepare(query).bind(...binds).all();
      return { leaderboard: results, metric, count: results.length };
    }

    case 'cbb_team_analytics': {
      const batters = await env.DB.prepare(
        'SELECT * FROM cbb_batting_advanced WHERE team_id = ? AND season = ? ORDER BY woba DESC'
      ).bind(args.team_id, SEASON).all();
      const pitchers = await env.DB.prepare(
        'SELECT * FROM cbb_pitching_advanced WHERE team_id = ? AND season = ? ORDER BY fip ASC'
      ).bind(args.team_id, SEASON).all();
      return { team_id: args.team_id, batters: batters.results, pitchers: pitchers.results };
    }

    case 'cbb_park_factor': {
      const result = await env.DB.prepare(
        'SELECT * FROM cbb_park_factors WHERE team_id = ? AND season = ?'
      ).bind(args.team_id, SEASON).first();
      return result || { error: 'Park factor not found', team_id: args.team_id };
    }

    case 'cbb_conference_strength': {
      if (args.conference) {
        const result = await env.DB.prepare(
          'SELECT * FROM cbb_conference_strength WHERE conference = ? AND season = ?'
        ).bind(args.conference, SEASON).first();
        return result || { error: 'Conference not found' };
      }
      const { results } = await env.DB.prepare(
        'SELECT * FROM cbb_conference_strength WHERE season = ? ORDER BY strength_index DESC'
      ).bind(SEASON).all();
      return { conferences: results };
    }

    case 'cbb_compute_batting': {
      const stats: BattingLine = {
        pa: parseInt(args.pa), ab: parseInt(args.ab), h: parseInt(args.h),
        doubles: parseInt(args.doubles), triples: parseInt(args.triples), hr: parseInt(args.hr),
        bb: parseInt(args.bb), hbp: parseInt(args.hbp), so: parseInt(args.so), sf: parseInt(args.sf),
      };
      const advanced = computeFullBattingLine(stats, DEFAULT_LEAGUE_CONTEXT, 1.0, MLB_WOBA_WEIGHTS);
      const hrRate = stats.ab > 0 ? stats.hr / stats.ab : 0;
      const estimated = computeEstimatedBatting(advanced.babip, advanced.iso, hrRate, advanced.kPct, advanced.bbPct);
      return { input: stats, advanced, estimated, weights: MLB_WOBA_WEIGHTS };
    }

    case 'cbb_compute_pitching': {
      const stats: PitchingLine = {
        ip: parseFloat(args.ip), h: parseInt(args.h), er: parseInt(args.er),
        hr: parseInt(args.hr), bb: parseInt(args.bb), hbp: parseInt(args.hbp), so: parseInt(args.so),
      };
      const advanced = computeFullPitchingLine(stats, DEFAULT_LEAGUE_CONTEXT);
      return { input: stats, advanced, league_context: DEFAULT_LEAGUE_CONTEXT };
    }

    case 'cbb_havf_player': {
      const result = await env.DB.prepare(
        'SELECT * FROM havf_scores WHERE player_id = ? AND season = ?'
      ).bind(args.player_id, SEASON).first();
      return result || { error: 'HAV-F data not found', player_id: args.player_id };
    }

    case 'cbb_mmi_game': {
      const { results } = await env.DB.prepare(
        'SELECT * FROM mmi_snapshots WHERE game_id = ? ORDER BY snapshot_order ASC'
      ).bind(args.game_id).all();
      if (results.length === 0) return { error: 'MMI data not found', game_id: args.game_id };
      return { game_id: args.game_id, snapshots: results };
    }

    case 'cbb_glossary': {
      const entry = METRIC_GLOSSARY[args.metric];
      if (!entry) return { error: `Unknown metric: ${args.metric}`, available: Object.keys(METRIC_GLOSSARY) };
      return { metric: args.metric, ...entry };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleMcpRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    body = await request.json() as typeof body;
  } catch {
    return mcpError(null, -32700, 'Parse error');
  }

  const { id, method, params } = body;

  switch (method) {
    case 'initialize':
      return mcpJsonRpc(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        serverInfo: SERVER_INFO,
      });

    case 'tools/list':
      return mcpJsonRpc(id, { tools: MCP_TOOLS });

    case 'resources/list':
      return mcpJsonRpc(id, { resources: MCP_RESOURCES });

    case 'resources/read': {
      const uri = (params as Record<string, unknown>)?.uri as string;
      if (!uri) return mcpError(id, -32602, 'Missing uri parameter');

      // Try static first
      const staticContent = resolveStaticResource(uri);
      if (staticContent) {
        return mcpJsonRpc(id, {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(staticContent) }],
        });
      }

      // Dynamic resources (conferences, teams) need DB
      if (uri === 'cbb://conferences') {
        try {
          const { results } = await env.DB.prepare(
            'SELECT * FROM cbb_conference_strength WHERE season = 2026 ORDER BY strength_index DESC'
          ).all();
          return mcpJsonRpc(id, {
            contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(results) }],
          });
        } catch {
          return mcpError(id, -32603, 'Failed to read conferences');
        }
      }

      if (uri === 'cbb://teams') {
        try {
          const { results } = await env.DB.prepare(
            'SELECT DISTINCT team, team_id, conference FROM cbb_batting_advanced WHERE season = 2026 ORDER BY team'
          ).all();
          return mcpJsonRpc(id, {
            contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(results) }],
          });
        } catch {
          return mcpError(id, -32603, 'Failed to read teams');
        }
      }

      return mcpError(id, -32602, `Unknown resource: ${uri}`);
    }

    case 'tools/call': {
      const toolName = (params as Record<string, unknown>)?.name as string;
      const args = ((params as Record<string, unknown>)?.arguments ?? {}) as Record<string, string>;

      try {
        const result = await executeTool(toolName, args, env);
        return mcpJsonRpc(id, toolResult(result));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Tool execution failed';
        return mcpJsonRpc(id, toolResult({ error: msg }, true));
      }
    }

    default:
      return mcpError(id, -32601, `Method not found: ${method}`);
  }
}
