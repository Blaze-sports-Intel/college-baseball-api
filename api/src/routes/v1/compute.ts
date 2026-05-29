import { Hono } from 'hono';
import type { Env, Tier } from '../../shared/types';
import {
  computeFullBattingLine,
  computeFullPitchingLine,
  computeEstimatedBatting,
  DEFAULT_LEAGUE_CONTEXT,
  getD1WOBAWeights,
  D1_LATEST_CALIBRATED_SEASON,
} from '@bsi/college-baseball-analytics';
import type { BattingLine, PitchingLine } from '@bsi/college-baseball-analytics';

/**
 * Default weights for stateless `/v1/compute/*` calls — D1 latest calibrated
 * season (Blumenfeld 2022 reference). Callers can pin to a specific season
 * with `?season=YYYY` for historical comparisons.
 */
const DEFAULT_D1_WEIGHTS = getD1WOBAWeights(D1_LATEST_CALIBRATED_SEASON);
import { buildMeta } from '../../shared/helpers';
import { badRequest } from '../../shared/errors';

const compute = new Hono<{ Bindings: Env; Variables: { tier: Tier } }>();

/**
 * POST /v1/compute/batting
 * Stateless: raw batting stats in → full advanced metrics out.
 * Pro tier required.
 *
 * Body: { pa, ab, h, doubles, triples, hr, bb, hbp, so, sf, parkFactor? }
 */
compute.post('/batting', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const required = ['pa', 'ab', 'h', 'doubles', 'triples', 'hr', 'bb', 'hbp', 'so', 'sf'];
  for (const field of required) {
    if (typeof body[field] !== 'number') {
      return badRequest(`Missing or invalid field: ${field} (must be a number)`);
    }
  }

  const stats: BattingLine = {
    pa: body.pa as number,
    ab: body.ab as number,
    h: body.h as number,
    doubles: body.doubles as number,
    triples: body.triples as number,
    hr: body.hr as number,
    bb: body.bb as number,
    hbp: body.hbp as number,
    so: body.so as number,
    sf: body.sf as number,
  };

  const parkFactor = typeof body.parkFactor === 'number' ? body.parkFactor : 1.0;
  // Allow callers to pin a specific season's weights via ?season=YYYY.
  const seasonParam = c.req.query('season');
  const seasonNum = seasonParam ? parseInt(seasonParam, 10) : undefined;
  const weights = getD1WOBAWeights(seasonNum);
  const weightsSource = seasonNum && Number.isFinite(seasonNum)
    ? `d1-reference-${Math.min(seasonNum, D1_LATEST_CALIBRATED_SEASON)}`
    : `d1-reference-${D1_LATEST_CALIBRATED_SEASON}`;

  const advanced = computeFullBattingLine(stats, DEFAULT_LEAGUE_CONTEXT, parkFactor, weights);

  // Also compute estimated metrics
  const hrRate = stats.ab > 0 ? stats.hr / stats.ab : 0;
  const estimated = computeEstimatedBatting(
    advanced.babip,
    advanced.iso,
    hrRate,
    advanced.kPct,
    advanced.bbPct,
  );

  return c.json({
    data: {
      input: stats,
      advanced,
      estimated,
      weights_used: weights,
      weights_source: weightsSource,
      league_context: DEFAULT_LEAGUE_CONTEXT,
      park_factor: parkFactor,
    },
    meta: buildMeta('bsi-cbb-api-compute', false, 'pro'),
  });
});

/**
 * POST /v1/compute/pitching
 * Stateless: raw pitching stats in → full advanced metrics out.
 * Pro tier required.
 *
 * Body: { ip, h, er, hr, bb, hbp, so, fb?, parkFactor? }
 */
compute.post('/pitching', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const required = ['ip', 'h', 'er', 'hr', 'bb', 'hbp', 'so'];
  for (const field of required) {
    if (typeof body[field] !== 'number') {
      return badRequest(`Missing or invalid field: ${field} (must be a number)`);
    }
  }

  const stats: PitchingLine = {
    ip: body.ip as number,
    h: body.h as number,
    er: body.er as number,
    hr: body.hr as number,
    bb: body.bb as number,
    hbp: body.hbp as number,
    so: body.so as number,
    ...(typeof body.fb === 'number' && { fb: body.fb as number }),
  };

  const parkFactor = typeof body.parkFactor === 'number' ? body.parkFactor : 1.0;
  const advanced = computeFullPitchingLine(stats, DEFAULT_LEAGUE_CONTEXT, parkFactor);

  return c.json({
    data: {
      input: stats,
      advanced,
      league_context: DEFAULT_LEAGUE_CONTEXT,
      park_factor: parkFactor,
    },
    meta: buildMeta('bsi-cbb-api-compute', false, 'pro'),
  });
});

export default compute;
