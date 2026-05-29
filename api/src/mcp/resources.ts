/**
 * MCP Resource Definitions — 8 resources for college baseball analytics.
 * Resources are read-only reference data that MCP clients can subscribe to.
 */

import {
  MLB_WOBA_WEIGHTS,
  DEFAULT_LEAGUE_CONTEXT,
  HAVF_WEIGHTS,
  MMI_WEIGHTS,
  METRIC_GLOSSARY,
  METHODOLOGY,
} from '@bsi/college-baseball-analytics';

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const MCP_RESOURCES: MCPResource[] = [
  {
    uri: 'cbb://methodology/woba',
    name: 'wOBA Methodology',
    description: 'wOBA formula, weight table, and derivation notes',
    mimeType: 'application/json',
  },
  {
    uri: 'cbb://methodology/fip',
    name: 'FIP Methodology',
    description: 'FIP formula, constant derivation, and interpretation guide',
    mimeType: 'application/json',
  },
  {
    uri: 'cbb://methodology/havf',
    name: 'HAV-F Methodology',
    description: 'HAV-F components, weights, and percentile ranking methodology',
    mimeType: 'application/json',
  },
  {
    uri: 'cbb://methodology/mmi',
    name: 'MMI Methodology',
    description: 'MMI formula, component breakdown, and classification thresholds',
    mimeType: 'application/json',
  },
  {
    uri: 'cbb://weights/current',
    name: 'Current Weights',
    description: 'Current linear weights, league context, and component weights',
    mimeType: 'application/json',
  },
  {
    uri: 'cbb://glossary',
    name: 'Metric Glossary',
    description: 'Complete glossary of all supported metrics with formulas and tier info',
    mimeType: 'application/json',
  },
  {
    uri: 'cbb://conferences',
    name: 'Conference List',
    description: 'All D1 conferences with strength indices',
    mimeType: 'application/json',
  },
  {
    uri: 'cbb://teams',
    name: 'D1 Teams',
    description: 'All 244 D1 teams with IDs and conference affiliations',
    mimeType: 'application/json',
  },
  {
    uri: 'cbb://history/sources',
    name: 'Historical Source Registry',
    description: 'Accepted source lanes for NCAA D1 baseball history and provenance',
    mimeType: 'application/json',
  },
  {
    uri: 'cbb://history/endpoints',
    name: 'Historical API Endpoints',
    description: 'BSI D1 history endpoint contract with four explicit data states',
    mimeType: 'application/json',
  },
];

/** Resolve a resource URI to its content. Static resources return data directly; dynamic ones need DB. */
export function resolveStaticResource(uri: string): unknown | null {
  switch (uri) {
    case 'cbb://methodology/woba':
      return { ...METHODOLOGY.woba, weights: MLB_WOBA_WEIGHTS };
    case 'cbb://methodology/fip':
      return { ...METHODOLOGY.fip, league_context: { fipConstant: DEFAULT_LEAGUE_CONTEXT.fipConstant } };
    case 'cbb://methodology/havf':
      return { ...METHODOLOGY.havf, weights: HAVF_WEIGHTS };
    case 'cbb://methodology/mmi':
      return { ...METHODOLOGY.mmi, weights: MMI_WEIGHTS };
    case 'cbb://weights/current':
      return {
        woba_weights: MLB_WOBA_WEIGHTS,
        league_context: DEFAULT_LEAGUE_CONTEXT,
        havf_weights: HAVF_WEIGHTS,
        mmi_weights: MMI_WEIGHTS,
      };
    case 'cbb://glossary':
      return METRIC_GLOSSARY;
    case 'cbb://history/sources':
      return {
        canonical: ['NCAA records PDFs', 'NCAA championship dashboard', 'NCAA membership dashboard', 'official school/SID pages'],
        supporting: ['ESPN college baseball site API', 'BSI college-baseball-api contract'],
        lead_only: ['Scite peer-reviewed methodology searches', 'community package or forum leads'],
        policy: 'Scite and community leads cannot override official NCAA, school, conference, ESPN, or BSI contract sources.',
      };
    case 'cbb://history/endpoints':
      return {
        state_values: ['loading', 'error', 'empty', 'populated'],
        meta: { source: 'bsi-d1-history', fetched_at: 'source snapshot timestamp', timezone: 'America/Chicago' },
        endpoints: [
          '/v1/history/seasons',
          '/v1/history/teams',
          '/v1/history/teams/:teamId/seasons',
          '/v1/history/games',
          '/v1/history/games/:gameId/box-score',
          '/v1/history/games/:gameId/play-by-play',
          '/v1/history/tournaments',
          '/v1/history/polls',
          '/v1/history/awards',
          '/v1/history/provenance/:recordId',
        ],
      };
    default:
      return null;
  }
}
